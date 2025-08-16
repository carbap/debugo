package main

import (
    "bytes"
    "syscall/js"

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

    // Keep WASM running
    select {}
}

