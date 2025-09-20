

const checkResult = (result) => {
    if (result?.error != "") {
        console.log(result.error);
        return false;
    }
    return true;
}

const go = new Go(); // from wasm_exec.js
let mod, inst;

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const baseURL = isLocal ? "http://localhost:8000/" : "https://go-in-browser.vercel.app/";

const runBtn = document.getElementById("runBtn");
const debugBtn = document.getElementById("debugBtn");
const continueBtn = document.getElementById("continueBtn");
const debugOutput = document.getElementById("debugOutput");
const debugScope = document.getElementById("debugScope");

const statusBar = document.getElementById("statusBar");
let statusBarTimeout = null;
let runNumber = 0;

const infoBtn = document.getElementById("infoBtn");
let arrowRotation = 0;
const infoSection = document.getElementById("infoSection");
let isInfoSectionOpened = false;

const shareBtn = document.getElementById("shareBtn");
let shareBtnTimeout = null;

const scopeVariables = document.getElementById("scopeVariables");

function reset() {
    runBtn.disabled = false;
    debugBtn.disabled = false;
    continueBtn.disabled = true;
    setReadonly(false)
    selectOutput();
    debugScope.style.display = 'none';
    renderScopeVariables([]);
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
    debugScope.style.display = 'block';
}
function selectDebugOption(optionToSelect, optionsToDeselect) {
    optionToSelect.classList.add("debugOptionSelected");
    if (optionsToDeselect?.length > 0) {
        optionsToDeselect.forEach(option => {
            option.classList.remove("debugOptionSelected");
        });
    }
}
function activateDebugOption(optionToSelect, optionsToDeselect) {
    optionToSelect.classList.add("active");
    if (optionsToDeselect?.length > 0) {
        optionsToDeselect.forEach(option => {
            option.classList.remove("active");
        });
    }
}
function selectOutput() {
    selectDebugOption(debugOutput, [debugScope]);
    activateDebugOption(output, [scopeVariables]);
}
function selectScope() {
    selectDebugOption(debugScope, [debugOutput]);
    activateDebugOption(scopeVariables, [output]);
}
debugOutput.addEventListener("click", async () => {
    selectOutput();
});
debugScope.addEventListener("click", async () => {
    selectScope();
});

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
            showErrorStatus();
        } else {
            content = result.output;
            showSuccessStatus();
        }
    } catch (ex) {
        content = ex
    }
    output.textContent = content;
});

const mainSection = document.getElementById('mainSection');
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
    const containerHeight = mainSection.clientHeight > 0 ? mainSection.clientHeight : 1;
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
    const containerHeight = mainSection.clientHeight;
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
        showErrorStatus();
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
        showSuccessStatus();
        return;
    } else if (reason == DebugEventReason.DebugBreak && position != null) {
        const bp = window.getBreakpointValues().find(bp => bp.position == position);
        if (bp != null) {
            window.highlightedLineNumber = bp.lineNumber;
            console.log(`Highlight line ${bp.lineNumber} (${bp.position})`);
        }
        window.setDecorations();
        renderScopeVariables(infoFrames[0].variables);
    }
    output.textContent = stdout;
};

function showSuccessStatus() {
    showStatus(true);
}

function showErrorStatus() {
    showStatus(false);
}

function showStatus(isSuccess) {
    runNumber += 1;
    showMessage(isSuccess, `Run #${runNumber}: ${isSuccess ? "Success" : "Error"}`);
}

function showMessage(isSuccess, message) {
    statusBar.textContent = message;
    statusBar.classList.remove(...[isSuccess ? "error" : "success"]);
    statusBar.classList.add(...["active", isSuccess ? "success" : "error"]);
    if (statusBarTimeout != null) {
        clearTimeout(statusBarTimeout);
    }
    statusBarTimeout = setTimeout(() => {
        statusBar.classList.remove("active");
    }, 3000);
}
window.showMessage = showMessage;

infoBtn.addEventListener("click", () => {
    toggleInfoSection();
});
function toggleInfoSection() {
    isInfoSectionOpened = !isInfoSectionOpened;
    arrowRotation += 180;
    infoBtn.style.setProperty('--arrow-rotation', `${arrowRotation}deg`)
    if (isInfoSectionOpened) {
        infoSection.classList.add("active");
    } else {
        infoSection.classList.remove("active");
    }
}
window.toggleInfoSection = toggleInfoSection;

function renderScopeVariables(variables) {
    scopeVariables.innerHTML = "";

    const table = document.createElement("table");

    const header = table.createTHead();
    const headerRow = header.insertRow();
    ["Name", "Type", "Value"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    variables.forEach(v => {
        const row = tbody.insertRow();
        [v.name, v.type, v.value].forEach(val => {
            const td = row.insertCell();
            td.textContent = val;
            td.addEventListener("click", async () => {
                inspectVariable(v.name, td.textContent);
            });
        });
    });

    scopeVariables.appendChild(table);
}

shareBtn.addEventListener("click", async () => {
    try {
        const encoded = window.base64UrlEncode(window.editor.getValue());
        const link = `${baseURL}#${encoded}`;
        await navigator.clipboard.writeText(link);
        window.showMessage(true, "Copied link to clipboard");
    } catch (err) {
        console.error("Failed to copy: ", err);
        window.showMessage(false, "Failed to copy link");
        return;
    }

    shareBtn.textContent = "Copied!";
    shareBtn.classList.add("copied");

    if (shareBtnTimeout != null) {
        clearTimeout(shareBtnTimeout);
    }
    shareBtnTimeout = setTimeout(() => {
        shareBtn.textContent = "Copy link";
        shareBtn.classList.remove("copied");
    }, 1000);
});

class ScopeVar {
    constructor(str, startIndex, endIndex) {
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.value = str.slice(this.startIndex + 1, this.endIndex).trim();
    }
}

const OPEN_CURLY   = '{';
const CLOSE_CURLY  = '}';
const OPEN_SQUARE  = '[';
const CLOSE_SQUARE = ']';
const COMMA = ',';
const QUOTE = '"';

function printScopeVars(scopeVars) {
    if (scopeVars == null || scopeVars.length <= 0) {
        return;
    }
    scopeVars.forEach(sv => {
        console.log(sv);
        printScopeVars(processVariableString(sv.value))
    });
}

function processVariableString(str) {
    const scopeVars = [];
    const pushScopeVar = (variableStr, startIndex, endIndex) => {
        const scopeVar = new ScopeVar(variableStr, startIndex, endIndex);
        if (scopeVar.value != "") {
            scopeVars.push(scopeVar);
        }
    }
    let currentStartIndex = 0;
    let openChar = null;
    let endChar = null;
    let open = 0;
    let quotesAreOpen = false;
    for (let i = 0; i < str.length; i++) {
        if (str[i] == QUOTE) {
            quotesAreOpen = !quotesAreOpen;
        }
        if (quotesAreOpen) {
            continue;
        }
        if (str[i] == OPEN_CURLY || str[i] == OPEN_SQUARE) {
            if (openChar == null) {
                currentStartIndex = i;
                openChar = str[i];
                endChar = openChar == OPEN_CURLY ? CLOSE_CURLY : CLOSE_SQUARE;
            }
            open += 1;
        } else if (str[i] == CLOSE_CURLY || str[i] == CLOSE_SQUARE) {
            open -= 1;
            if (open == 0) {
                pushScopeVar(str, currentStartIndex, i);
            }
        } else if (str[i] == COMMA && open == 1) {
            pushScopeVar(str, currentStartIndex, i);
            currentStartIndex = i;
        }
    }
    return scopeVars;
}

function inspectVariable(variableName, variableString) {
    const scopeVars = processVariableString(variableString);
    if (scopeVars.length <= 0) {
        return;
    }


    const container = document.createElement("div");
    container.id = "inspectVariables";

    const frame = document.createElement("div");
    frame.classList.add("variableFrame");

    const headerSpan = document.createElement("span");
    headerSpan.textContent = variableName;

    const header = document.createElement("div");
    header.classList.add("variableFrame-header");
    header.appendChild(headerSpan);

    frame.appendChild(header);

    scopeVars.forEach((v, i) => {
        const rowSpan = document.createElement("span");
        rowSpan.textContent = v.value;

        const row = document.createElement("div");
        row.classList.add("variableFrame-row");
        row.appendChild(rowSpan);

        frame.appendChild(row);
    });

    container.appendChild(frame);

    const overlay = document.createElement("div");
    overlay.id = "inspectVariablesOverlay";
    overlay.appendChild(container);
    overlay.addEventListener("click", (e) => {
        if (!container.contains(e.target)) {
            overlay.remove();
        }
    });
    document.documentElement.appendChild(overlay);
}
