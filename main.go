package main

import (
    "fmt"
    "bytes"
    "syscall/js"
    "context"

    "github.com/traefik/yaegi/interp"
    "github.com/traefik/yaegi/stdlib"
)

var err error
var interpreter *interp.Interpreter
var program *interp.Program
var debugger *interp.Debugger
var breakpointTarget interp.BreakpointTarget
var stdout *bytes.Buffer
var stderr *bytes.Buffer

func main() {
    js.Global().Set("runYaegi", js.FuncOf(func(this js.Value, args []js.Value) any {
        if len(args) < 1 {
            return "no code provided"
        }
        code := args[0].String()

        stdout = &bytes.Buffer{}
        stderr = &bytes.Buffer{}

        interpreter = interp.New(interp.Options{
            Stdout: stdout,
            Stderr: stderr,
        })
        interpreter.Use(stdlib.Symbols)

        _, err = interpreter.Eval(code)
        if err != nil {
            return err.Error()
        }

        return stdout.String()
    }))

    js.Global().Set("startYaegiDebug", js.FuncOf(func(this js.Value, args []js.Value) any {
        if len(args) != 2 {
            return "missing code and breakpointLineNumbers arguments"
        }
        code := args[0].String()
        breakpointLineNumbers := args[1]
        if err = validateJSArray(breakpointLineNumbers); err != nil {
            return err.Error();
        }

        stdout = &bytes.Buffer{}
        stderr = &bytes.Buffer{}

        interpreter = interp.New(interp.Options{
            Stdout: stdout,
            Stderr: stderr,
        })
        interpreter.Use(stdlib.Symbols)

		program, err = interpreter.Compile(code)
		if err != nil {
			return err.Error()
		}

        ctx := context.Background()
        events := func(e *interp.DebugEvent) {
            reasonJS := js.ValueOf(int(e.Reason()))
            js.Global().Call("onDebugEvent", reasonJS)
        }
        var opts *interp.DebugOptions = nil
		debugger = interpreter.Debug(ctx, program, events, opts)
        breakpointTarget = interp.ProgramBreakpointTarget(program)

        setBreakpoints(breakpointLineNumbers)

		if err = debugger.Continue(0); err != nil {
            fmt.Println("error when starting debug")
			return err.Error()
		}

        fmt.Println("started debugging")
		return stdout.String()
    }))

    js.Global().Set("setYaegiBreakpoints", js.FuncOf(func(this js.Value, args []js.Value) any {
        breakpointLineNumbers := args[0]
        if err = validateJSArray(breakpointLineNumbers); err != nil {
            errStr := err.Error()
            fmt.Println(errStr)
            return errStr;
        }
        setBreakpoints(breakpointLineNumbers)
        return nil
    }))

    js.Global().Set("continueYaegiDebug", js.FuncOf(func(this js.Value, p []js.Value) any {
        if err = debugger.Continue(0); err != nil {
            fmt.Println("error when continuing debug")
            return err.Error()
        }
        fmt.Println("continued debugging")
        return stdout.String()
    }))

    // Keep WASM running
    select {}
}

func validateJSArray(obj js.Value) error {
    if !obj.InstanceOf(js.Global().Get("Array")) {
        return fmt.Errorf("obj must be a javascript array")
    }
    return nil
}

func setBreakpoints(breakpointLineNumbers js.Value) {
    if (debugger == nil || breakpointTarget == nil) {
        return
    }

    breakpointIndexToLineNumber := make(map[int]int)
    var breakpointRequests []interp.BreakpointRequest

    for i := 0; i < breakpointLineNumbers.Length(); i++ {
        lineNumber := breakpointLineNumbers.Index(i).Int()
        breakpointRequests = append(breakpointRequests, interp.LineBreakpoint(lineNumber))
        breakpointIndexToLineNumber[i] = lineNumber
        fmt.Println("breakpoint", i, "on line", lineNumber)
    }

    breakpoints := debugger.SetBreakpoints(breakpointTarget, breakpointRequests...)

    var invalidBreakpointLineNumbers []int
    for i, bp := range breakpoints {
        if bp.Valid {
            fmt.Println("valid breakpoint", i, "set at", bp.Position)
        } else {
            fmt.Println("invalid breakpoint", i)
            invalidBreakpointLineNumbers = append(invalidBreakpointLineNumbers, breakpointIndexToLineNumber[i])
        }
    }

    invalidBreakpointLineNumbersJS := js.Global().Get("Set").New()
    for _, lineNumber := range invalidBreakpointLineNumbers {
        invalidBreakpointLineNumbersJS.Call("add", lineNumber)
    }
    js.Global().Call("invalidateBreakpoints", invalidBreakpointLineNumbersJS)
}

