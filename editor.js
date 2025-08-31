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
    const editor = monaco.editor.create(document.getElementById("editor"), {
        value: code,
        language: "go",
        theme: "vs-dark",
        automaticLayout: true,
	glyphMargin: true
    });

    const breakpoints = new Set();
    let decorations = [];

    editor.onMouseDown(e => {
	if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS && 
	e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
		return;
	}
            const line = e.target.position.lineNumber;

            if (breakpoints.has(line)) {
                breakpoints.delete(line);
            } else {
                breakpoints.add(line);
            }

            decorations = editor.deltaDecorations(decorations,
                [...breakpoints].map(line => ({
                    range: new monaco.Range(line, 1, line, 1),
                    options: {
                        isWholeLine: true,
                        glyphMarginClassName: "debugBreakpoint"
                    }
                }))
            );
    });

    window.editor = editor;
    window.getBreakpoints = () => [...breakpoints];
});
