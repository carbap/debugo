// Configure Monaco’s AMD loader
require.config({
    paths: {
        vs: "https://unpkg.com/monaco-editor@0.52.2/min/vs"
    }
});

const code =
    `package main
import "fmt"
func main() {
	fmt.Println("Hello World!")
}`;

require(["vs/editor/editor.main"], function() {
    window.editor = monaco.editor.create(document.getElementById("editor"), {
        value: code,
        language: "go",
        theme: "vs-dark",
        automaticLayout: true
    });
});
