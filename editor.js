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

const breakpoints = new Set();
let invalidBreakpoints = new Set();
let decorations = [];
const DEBUG_BREAKPOINT = "debugBreakpoint";
const INVALID_DEBUG_BREAKPOINT = "invalidDebugBreakpoint";

require(["vs/editor/editor.main"], function () {
    const editor = monaco.editor.create(document.getElementById("editor"), {
        value: code,
        language: "go",
        theme: "vs-dark",
        automaticLayout: true,
        glyphMargin: true
    });

    window.editor = editor;
    window.breakpoints = breakpoints;
    window.invalidBreakpoints = invalidBreakpoints;

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

        setDecorations();
        setYaegiBreakpoints([...breakpoints]);
    });
});

window.invalidateBreakpoints = function (event) {
    invalidBreakpoints = event;
    setDecorations();
};

const setDecorations = () => {
    decorations = window.editor.deltaDecorations(
        decorations,
        [...breakpoints].map(line => {
            const glyphMarginClassName = invalidBreakpoints.has(line) ?
                INVALID_DEBUG_BREAKPOINT : DEBUG_BREAKPOINT
            return {
                range: new monaco.Range(line, 1, line, 1),
                options: {
                    isWholeLine: true,
                    glyphMarginClassName: glyphMarginClassName
                }
            };
        })
    );
};
