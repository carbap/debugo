

const checkResult = (result) => {
    if (result.error != "") {
        console.log(result.error);
        return false;
    }
    return true;
}

const go = new Go(); // from wasm_exec.js
let mod, inst;

const runBtn = document.getElementById("runBtn");
const debugBtn = document.getElementById("debugBtn");
const continueBtn = document.getElementById("continueBtn");

function reset() {
    runBtn.disabled = false;
    debugBtn.disabled = false;
    continueBtn.disabled = true;
    setReadonly(false)
}
window.reset = reset;

function resetOutput() {
    output.textContent = "";
}

function setDebug() {
    runBtn.disabled = true;
    debugBtn.disabled = true;
    continueBtn.disabled = false;
    setReadonly(true)
    resetOutput();
}

async function initWasm() {
    const resp = await fetch("yaegi.wasm");
    const buf = await resp.arrayBuffer();
    const result = await WebAssembly.instantiate(buf, go.importObject);
    mod = result.module;
    inst = result.instance;

    // Start the Go runtime (long-running)
    go.run(inst);

    reset();
    console.log("Yaegi ready");
}

initWasm();

runBtn.addEventListener("click", async () => {
    const code = window.editor.getValue();
    resetOutput();
    let content = null;
    try {
        const result = runYaegi(code);
        if (!checkResult(result)) {
            content = result.error;
        } else {
            content = result.output;
        }
    } catch (ex) {
        content = ex
    }
    output.textContent = content;
});

const splitContainer = document.getElementById('splitContainer');
const editor = document.getElementById('editor');
const resizer = document.getElementById('resizer');
const outputDiv = document.getElementById('outputDiv');
const output = document.getElementById('output');

function setReadonly(flag) {
    if (window.editor?.updateOptions != null) {
        window.editor.updateOptions({ readOnly: flag });
    }
}

let isResizing = false;
let lastEditorRatio = 0.618;

function startResize(e) {
    isResizing = true;
    document.body.style.cursor = 'row-resize';
    resizer.classList.add("active");
}

function stopResize() {
    isResizing = false;
    document.body.style.cursor = 'default';
    resizer.classList.remove("active");
}

function doResize(clientY) {
    const containerHeight = splitContainer.clientHeight > 0 ? splitContainer.clientHeight : 1;
    let newEditorHeight = clientY - editor.offsetTop;
    let newOutputHeight = containerHeight - newEditorHeight - resizer.offsetHeight;

    const minHeight = 0.1 * containerHeight;
    if (newEditorHeight < minHeight) {
        newEditorHeight = minHeight;
    }
    newOutputHeight = containerHeight - newEditorHeight - resizer.offsetHeight;
    if (newOutputHeight < minHeight) {
        newOutputHeight = minHeight;
        newEditorHeight = containerHeight - newOutputHeight - resizer.offsetHeight;
    }

    editor.style.height = `${newEditorHeight}px`;
    outputDiv.style.height = `${newOutputHeight}px`;

    lastEditorRatio = newEditorHeight / containerHeight;
}

resizer.addEventListener('mousedown', startResize);
document.addEventListener('mousemove', (e) => {
    if (isResizing) doResize(e.clientY);
});
document.addEventListener('mouseup', stopResize);

resizer.addEventListener('touchstart', (e) => {
    startResize(e.touches[0]);
});
document.addEventListener('touchmove', (e) => {
    if (isResizing) doResize(e.touches[0].clientY);
});
document.addEventListener('touchend', stopResize);

window.addEventListener('resize', () => {
    const containerHeight = splitContainer.clientHeight;
    const newEditorHeight = containerHeight * lastEditorRatio;
    const newOutputHeight = containerHeight - newEditorHeight - resizer.offsetHeight;

    editor.style.height = `${newEditorHeight}px`;
    outputDiv.style.height = `${newOutputHeight}px`;
});

debugBtn.addEventListener("click", () => {
    setDebug();
    const code = window.editor.getValue();
    const result = startYaegiDebug(code, window.getBreakpointLineNumbers());
    if (!checkResult(result)) {
        output.textContent += result.error;
    }
});

continueBtn.addEventListener("click", () => {
    const result = continueYaegiDebug();
    if (!checkResult(result)) {
        output.textContent += result.error;
    }
});

const DebugEventReason = {
    debugRun: 0,
    DebugPause: 1,
    DebugBreak: 2,
    DebugEntry: 3,
    DebugStepInto: 4,
    DebugStepOver: 5,
    DebugStepOut: 6,
    DebugTerminate: 7,
    DebugEnterGoRoutine: 8,
    DebugExitGoRoutine: 9
};

const DebugEventReasonName = Object.fromEntries(
    Object.entries(DebugEventReason).map(([k, v]) => [v, k])
);

window.onDebugEvent = function (reason, stdout, infoFrames) {
    console.log(DebugEventReasonName[reason]);
    const position = infoFrames?.[0]?.position;
    if (reason == DebugEventReason.DebugTerminate) {
        reset();
        window.highlightedLineNumber = null;
        window.setDecorations();
        return;
    } else if (reason == DebugEventReason.DebugBreak && position != null) {
        const bp = window.getBreakpointValues().find(bp => bp.position == position);
        if (bp != null) {
            window.highlightedLineNumber = bp.lineNumber;
            console.log(`Highlight line ${bp.lineNumber} (${bp.position})`);
        }
        window.setDecorations();

    }
    output.textContent = stdout;
};
