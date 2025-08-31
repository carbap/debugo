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
        i := interp.New(interp.Options{
            Stdout: stdout,
            Stderr: stderr,
        })
        i.Use(stdlib.Symbols)

        // Evaluate user code
        _, err := i.Eval(code)
        if err != nil {
            return err.Error()
        }

        return stdout.String()
    }))

    js.Global().Set("runYaegiDebug", js.FuncOf(func(this js.Value, args []js.Value) any {
        if len(args) < 2 {
            return "missing code or breakpoints"
        }
        code := args[0].String()
        // breakpointsJS := args[1]

        stdout := &bytes.Buffer{}
        stderr := &bytes.Buffer{}

        i := interp.New(interp.Options{
            Stdout: stdout,
            Stderr: stderr,
        })
        i.Use(stdlib.Symbols)

		prog, err := i.Compile(code)
		if err != nil {
			return err.Error()
		}

        ctx := context.Background()
        events := func(e *interp.DebugEvent) {
            fmt.Println("Debug event:", e.Reason())
        }
        var opts *interp.DebugOptions = nil
		debugger := i.Debug(ctx, prog, events, opts)

		debugger.SetBreakpoints(interp.AllBreakpointTarget(), interp.FunctionBreakpoint("main"));

		// Start execution until first breakpoint
		if err := debugger.Continue(0); err != nil {
			return err.Error()
		}

		// Expose continue function to JavaScript
		js.Global().Set("continueDebug", js.FuncOf(func(this js.Value, p []js.Value) any {
			if err := debugger.Continue(0); err != nil {
				return err.Error()
			}
			return stdout.String()
		}))

		return stdout.String()
    }))

    // Keep WASM running
    select {}
}

