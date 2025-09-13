package main

import (
	"bytes"
	"context"
	"fmt"
	"reflect"
	"strings"
	"syscall/js"

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

const DEBUG_TERMINATE = 7
const DEBUG_BREAK = 2

func main() {
	js.Global().Set("runYaegi", js.FuncOf(func(this js.Value, args []js.Value) any {
		result := map[string]any{
			"error":  "",
			"output": "",
		}
		if isDebugging() {
			result["error"] = "can't run while debugging"
			return resetAndReturn(result)
		}
		if len(args) < 1 {
			result["error"] = "no code provided"
			return resetAndReturn(result)
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
			result["error"] = err.Error()
			return resetAndReturn(result)
		}

		fmt.Println("ran code")
		result["output"] = stdout.String()
		return resetAndReturn(result)
	}))

	js.Global().Set("startYaegiDebug", js.FuncOf(func(this js.Value, args []js.Value) any {
		result := map[string]any{
			"error":  "",
			"output": "",
		}
		if isDebugging() {
			result["error"] = "already debugging"
			return resetAndReturn(result)
		}
		if len(args) != 2 {
			result["error"] = "must provide code and breakpointLineNumbers"
			return resetAndReturn(result)
		}

		code := args[0].String()
		breakpointLineNumbers := args[1]
		if err = validateJSArray(breakpointLineNumbers); err != nil {
			result["error"] = err.Error()
			return resetAndReturn(result)
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
			result["error"] = err.Error()
			return resetAndReturn(result)
		}

		ctx := context.Background()
		events := func(e *interp.DebugEvent) {
			reason := e.Reason()
			if reason == DEBUG_TERMINATE {
				reset()
			}
			reasonJS := js.ValueOf(int(reason))
			outputJS := js.ValueOf(stdout.String())
			framesJS := js.ValueOf(-1)
			if reason == DEBUG_BREAK {
				frameDepth := int(e.FrameDepth())
				debugFrames := e.Frames(0, frameDepth-1)
				framesJS = js.Global().Get("Array").New(len(debugFrames))
				for i, df := range debugFrames {
					debugFrameScopes := df.Scopes()
					variablesJS := js.ValueOf(-1)
					if len(debugFrameScopes) >= 1 {
						debugVariables := debugFrameScopes[0].Variables()
						variablesJS = js.Global().Get("Array").New(len(debugVariables))
						for j, dv := range debugVariables {
							value, typeName := formatValue(dv.Value)
							variableJS := js.ValueOf(map[string]interface{}{
								"name":  dv.Name,
								"value": value,
								"type":  typeName,
							})
							variablesJS.SetIndex(j, variableJS)
						}
					}
					frameJS := js.ValueOf(map[string]interface{}{
						"name":      df.Name(),
						"position":  df.Position().String(),
						"variables": variablesJS,
					})
					framesJS.SetIndex(i, frameJS)
				}
			}
			js.Global().Call("onDebugEvent", reasonJS, outputJS, framesJS)
		}
		var opts *interp.DebugOptions = nil
		debugger = interpreter.Debug(ctx, program, events, opts)
		breakpointTarget = interp.ProgramBreakpointTarget(program)

		setBreakpoints(breakpointLineNumbers)

		if err = debugger.Continue(0); err != nil {
			result["error"] = err.Error()
			return resetAndReturn(result)
		}

		fmt.Println("started debugging")
		return result
	}))

	js.Global().Set("setYaegiBreakpoints", js.FuncOf(func(this js.Value, args []js.Value) any {
		result := map[string]any{
			"error":  "",
			"output": "",
		}
		if !isDebugging() {
			result["error"] = "must start debugging first"
			return resetAndReturn(result)
		}
		breakpointLineNumbers := args[0]
		if err = validateJSArray(breakpointLineNumbers); err != nil {
			result["error"] = err.Error()
			return resetAndReturn(result)
		}
		setBreakpoints(breakpointLineNumbers)

		fmt.Println("set breakpoints")
		return result
	}))

	js.Global().Set("continueYaegiDebug", js.FuncOf(func(this js.Value, p []js.Value) any {
		result := map[string]any{
			"error":  "",
			"output": "",
		}
		if !isDebugging() {
			result["error"] = "must start debugging first"
			return resetAndReturn(result)
		}
		if err = debugger.Continue(0); err != nil {
			result["error"] = err.Error()
			return resetAndReturn(result)
		}

		fmt.Println("continued debugging")
		return result
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

type MyBreakpointInfo struct {
	LineNumber int
	Position   string
	Valid      bool
}

func setBreakpoints(breakpointLineNumbers js.Value) {
	numBreakpoints := breakpointLineNumbers.Length()
	if !isDebugging() || numBreakpoints <= 0 {
		return
	}

	breakpointRequests := make([]interp.BreakpointRequest, numBreakpoints)
	breakpointInfo := make([]MyBreakpointInfo, numBreakpoints)

	for i := 0; i < numBreakpoints; i++ {
		lineNumber := breakpointLineNumbers.Index(i).Int()
		breakpointRequests[i] = interp.LineBreakpoint(lineNumber)
		breakpointInfo[i] = MyBreakpointInfo{
			LineNumber: lineNumber,
			Position:   "",
			Valid:      true,
		}
		fmt.Println("breakpoint", i, "on line", lineNumber)
	}

	breakpoints := debugger.SetBreakpoints(breakpointTarget, breakpointRequests...)

	breakpointsJS := js.Global().Get("Array").New(numBreakpoints)
	for i, bp := range breakpoints {
		breakpointInfo[i].Position = bp.Position.String()
		breakpointInfo[i].Valid = bp.Valid
		if bp.Valid {
			fmt.Println("valid breakpoint", i, "set at", bp.Position)
		} else {
			fmt.Println("invalid breakpoint", i)
		}
		bpJS := js.ValueOf(map[string]interface{}{
			"lineNumber": breakpointInfo[i].LineNumber,
			"position":   breakpointInfo[i].Position,
			"valid":      breakpointInfo[i].Valid,
		})
		breakpointsJS.SetIndex(i, bpJS)
	}
	js.Global().Call("updateBreakpoints", breakpointsJS)
}

func isDebugging() bool {
	return debugger != nil && breakpointTarget != nil
}

func reset() {
	err = nil
	interpreter = nil
	program = nil
	debugger = nil
	breakpointTarget = nil
	stdout = nil
	stderr = nil
	js.Global().Call("reset")
}

func resetAndReturn(result map[string]any) any {
	reset()
	return result
}

func formatValue(v reflect.Value) (string, string) {
	if !v.IsValid() {
		return "nil", "invalid"
	}

	typeName := v.Type().String()
	formatted := ""

	switch v.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		formatted = fmt.Sprintf("%d", v.Int())

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		formatted = fmt.Sprintf("%d", v.Uint())

	case reflect.Float32, reflect.Float64:
		formatted = fmt.Sprintf("%g", v.Float())

	case reflect.Bool:
		if v.Bool() {
			formatted = "true"
		} else {
			formatted = "false"
		}

	case reflect.String:
		formatted = fmt.Sprintf("%q", v.String())

	case reflect.Slice, reflect.Array:
		elems := []string{}
		for i := 0; i < v.Len(); i++ {
			elemStr, _ := formatValue(v.Index(i))
			elems = append(elems, elemStr)
		}
		formatted = "[" + strings.Join(elems, ", ") + "]"

	case reflect.Map:
		pairs := []string{}
		for _, key := range v.MapKeys() {
			keyStr, _ := formatValue(key)
			valStr, _ := formatValue(v.MapIndex(key))
			pairs = append(pairs, keyStr+": "+valStr)
		}
		formatted = "{" + strings.Join(pairs, ", ") + "}"

	case reflect.Struct:
		fields := []string{}
		for i := 0; i < v.NumField(); i++ {
			fieldStr, _ := formatValue(v.Field(i))
			fields = append(fields,
				v.Type().Field(i).Name+": "+fieldStr)
		}
		formatted = "{" + strings.Join(fields, ", ") + "}"

	case reflect.Interface:
		if v.IsNil() {
			formatted = "nil"
		} else {
			formatted, _ = formatValue(v.Elem())
		}

	case reflect.Pointer:
		if v.IsNil() {
			formatted = "nil"
		} else {
			formatted, _ = formatValue(v.Elem())
			formatted = fmt.Sprintf("%p: %s", v.Interface(), formatted)
		}

	case reflect.Complex64, reflect.Complex128:
		c := v.Complex()
		formatted = fmt.Sprintf("(%g+%gi)", real(c), imag(c))

	case reflect.Func, reflect.Chan:
		if v.IsNil() {
			formatted = "nil"
		} else {
			formatted = fmt.Sprintf("%p", v.Interface())
		}

	default:
		formatted = fmt.Sprintf("%v", v.Interface())
	}

	return formatted, typeName
}
