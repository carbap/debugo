// Configure Monaco’s AMD loader
require.config({
    paths: {
        vs: "https://unpkg.com/monaco-editor@0.52.2/min/vs"
    }
});

const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const code =
    `package main
import "fmt"
func main() {
	fmt.Println("Hello World!")
}`;

const breakpoints = {};
window.getBreakpointValues = () => {
    return Object.values(breakpoints).filter(bp => bp != null);
}
window.getBreakpointLineNumbers = () => {
    return window.getBreakpointValues().map(bp => bp.lineNumber);
}
let decorations = [];
window.highlightedLineNumber = null;
const DEBUG_BREAKPOINT = "debugBreakpoint";
const INVALID_DEBUG_BREAKPOINT = "invalidDebugBreakpoint";
const DEBUG_HIGHLIGHT_LINE = "debugHighlightLine";

require(["vs/editor/editor.main"], function () {
    const mobileOpts = {
        scrollBeyondLastLine: false,
        scrollBeyondLastColumn: 10,
        minimap: { enabled: false },
        smoothScrolling: true,
        scrollbar: {
            vertical: "auto",
            horizontal: "hidden",
            useShadows: false,
            verticalScrollbarSize: 8,
        },
        fontSize: 14,
        lineHeight: 24,
        dragAndDrop: true,
        renderWhitespace: "none",
    }
    const editor = monaco.editor.create(document.getElementById("editor"), {
        value: code,
        language: "go",
        theme: "vs-dark",
        automaticLayout: true,
        glyphMargin: true,
        ...(isMobile ? mobileOpts : {})
    });

    window.editor = editor;
    window.breakpoints = breakpoints;

    editor.onMouseDown(e => {
        if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS &&
            e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
            return;
        }
        const line = e.target.position.lineNumber;

        if (breakpoints[line] != null) {
            breakpoints[line] = null;
        } else {
            breakpoints[line] = {
                lineNumber: line,
                valid: true
            };
        }

        setDecorations();
        setYaegiBreakpoints(getBreakpointLineNumbers());
    });
});

window.updateBreakpoints = function (event) {
    if (breakpoints == null || Object.keys(breakpoints).length <= 0) {
        return;
    }
    if (event == null || event.length <= 0) {
        return;
    }
    event.forEach(bpInfo => {
        if (breakpoints[bpInfo.lineNumber] != null) {
            breakpoints[bpInfo.lineNumber] = {
                lineNumber: bpInfo.lineNumber,
                position: bpInfo.position,
                valid: bpInfo.valid
            }
        }
    });
    setDecorations();
};

const setDecorations = () => {
    const bpDecorations = window.getBreakpointValues().map(bp => {
        const glyphMarginClassName = bp.valid !== true ?
            INVALID_DEBUG_BREAKPOINT : DEBUG_BREAKPOINT
        return {
            range: new monaco.Range(bp.lineNumber, 1, bp.lineNumber, 1),
            options: {
                isWholeLine: true,
                glyphMarginClassName: glyphMarginClassName
            }
        };
    });
    const newDecorations = [...bpDecorations];
    if (window.highlightedLineNumber != null) {
        newDecorations.push({
            range: new monaco.Range(window.highlightedLineNumber, 1, window.highlightedLineNumber, 1),
            options: {
                isWholeLine: true,
                className: DEBUG_HIGHLIGHT_LINE,
                marginClassName: DEBUG_HIGHLIGHT_LINE
            }
        });
    }
    decorations = window.editor.deltaDecorations(
        decorations,
        newDecorations
    );
};
window.setDecorations = setDecorations;
