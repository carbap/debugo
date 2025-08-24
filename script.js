const go = new Go(); // from wasm_exec.js
let mod, inst;

async function initWasm() {
    const resp = await fetch("yaegi.wasm");
    const buf = await resp.arrayBuffer();
    const result = await WebAssembly.instantiate(buf, go.importObject);
    mod = result.module;
    inst = result.instance;

    // Start the Go runtime (long-running)
    go.run(inst);

    document.getElementById("runBtn").disabled = false;
    console.log("Yaegi ready");
}

initWasm();

document.getElementById("runBtn").addEventListener("click", async () => {
    const code = window.editor.getValue();
    const outputEl = document.getElementById("output");
    outputEl.textContent = "";

    try {
        const result = runYaegi(code);
        outputEl.textContent = result;
    } catch (err) {
        outputEl.textContent = "Error: " + err;
    }
});

const splitContainer = document.getElementById('splitContainer');
const editor = document.getElementById('editor');
const resizer = document.getElementById('resizer');
const output = document.getElementById('outputDiv');

let isResizing = false;
let lastEditorRatio = 0.618;

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
    output.style.height = `${newOutputHeight}px`;

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
    output.style.height = `${newOutputHeight}px`;
});
