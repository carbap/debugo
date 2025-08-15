package main

import (
    "bytes"
    "syscall/js"

    "github.com/traefik/yaegi/interp"
    "github.com/traefik/yaegi/stdlib"
)

func main() {
    stdout := &bytes.Buffer{}
    stderr := &bytes.Buffer{}

    i := interp.New(interp.Options{
        Stdout: stdout,
        Stderr: stderr,
    })
    i.Use(stdlib.Symbols)

    // Expose a "run" function to JS
    js.Global().Set("runYaegi", js.FuncOf(func(this js.Value, args []js.Value) any {
        if len(args) < 1 {
            return "no code provided"
        }
        code := args[0].String()
        stdout.Reset()
        stderr.Reset()
        _, err := i.Eval(code)
        if err != nil {
            return err.Error()
        }
        return stdout.String()
    }))

    // Keep Go WASM running
    select {}
}

