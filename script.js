

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

let isResizing = false;
let lastEditorRatio = 0.618;

function setReadonly(flag) {
    if (window.editor?.updateOptions != null) {
        window.editor.updateOptions({ readOnly: flag });
    }
}

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'row-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const containerHeight = splitContainer.clientHeight > 0 ? splitContainer.clientHeight : 1;
    let newEditorHeight = e.clientY - editor.offsetTop;
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
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
    }
});

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
    const breakpoints = [...window.breakpoints];
    const result = startYaegiDebug(code, breakpoints);
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
    if (reason == DebugEventReason.DebugTerminate) {
        reset();
        return;
    }
    output.textContent = stdout;
};
