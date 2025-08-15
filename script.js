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
    
const code = `
package main
import "fmt"
func main() {
${document.getElementById("code").value}
}`;
    const outputEl = document.getElementById("output");
    outputEl.textContent = "";

    try {
        // Call the Go function exposed from main.go
        const result = runYaegi(code);
        outputEl.textContent = result;
    } catch (err) {
        outputEl.textContent = "Error: " + err;
    }
});

