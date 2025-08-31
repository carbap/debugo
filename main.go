package main

import (
    "fmt"
    "bytes"
    "syscall/js"
    "context"

    "github.com/traefik/yaegi/interp"
    "github.com/traefik/yaegi/stdlib"
)

func main() {
    // Expose "runYaegi" to JavaScript
    js.Global().Set("runYaegi", js.FuncOf(func(this js.Value, args []js.Value) any {
        if len(args) < 1 {
            return "no code provided"
        }
        code := args[0].String()

        // Fresh stdout/stderr buffers for every run
        stdout := &bytes.Buffer{}
        stderr := &bytes.Buffer{}

        // Fresh interpreter instance for every run
        interpreter := interp.New(interp.Options{
            Stdout: stdout,
            Stderr: stderr,
        })
        interpreter.Use(stdlib.Symbols)

        // Evaluate user code
        _, err := interpreter.Eval(code)
        if err != nil {
            return err.Error()
        }

        return stdout.String()
    }))

    js.Global().Set("runYaegiDebug", js.FuncOf(func(this js.Value, args []js.Value) any {
        if len(args) != 2 {
            return "missing code and breakpoints"
        }
        code := args[0].String()
        uiBreakpoints := args[1]
        if !uiBreakpoints.InstanceOf(js.Global().Get("Array")) {
            return "breakpoints must be an array"
        }

        stdout := &bytes.Buffer{}
        stderr := &bytes.Buffer{}

        interpreter := interp.New(interp.Options{
            Stdout: stdout,
            Stderr: stderr,
        })
        interpreter.Use(stdlib.Symbols)

		prog, err := interpreter.Compile(code)
		if err != nil {
			return err.Error()
		}

        ctx := context.Background()
        events := func(e *interp.DebugEvent) {
            fmt.Println("debug event:", e.Reason())
        }
        var opts *interp.DebugOptions = nil
		debugger := interpreter.Debug(ctx, prog, events, opts)

        breakpointTarget := interp.ProgramBreakpointTarget(prog);
        var breakpointRequests []interp.BreakpointRequest
        for i := 0; i < uiBreakpoints.Length(); i++ {
            lineNumber := uiBreakpoints.Index(i).Int()            
            breakpointRequests = append(breakpointRequests, interp.LineBreakpoint(lineNumber))
            fmt.Println("breakpoint", i, "on line", lineNumber)
        }
		breakpoints := debugger.SetBreakpoints(breakpointTarget, breakpointRequests...);

        for i, bp := range breakpoints {
            if bp.Valid {
                fmt.Println("valid breakpoint", i, "set at", bp.Position)
            } else {
                fmt.Println("invalid breakpoint", i)
            }
        }

		if err := debugger.Continue(0); err != nil {
            fmt.Println("error when starting debug")
			return err.Error()
		}
        fmt.Println("started debugging")

		js.Global().Set("continueYaegiDebug", js.FuncOf(func(this js.Value, p []js.Value) any {
			if err := debugger.Continue(0); err != nil {
                fmt.Println("error when continuing debug")
				return err.Error()
			}
            fmt.Println("continued debugging")
			return stdout.String()
		}))

		return stdout.String()
    }))

    // Keep WASM running
    select {}
}

