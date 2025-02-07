// webworker.js
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.mjs";

let pyodideReadyPromise = loadPyodide();

async function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join("");
  return btoa(binString);
}

self.onmessage = async (event) => {
  // Wait for Pyodide to be ready
  const pyodide = await pyodideReadyPromise;
  const { id, python, context } = event.data;
  // Now load any packages we need, run the code, and send the result back
  await pyodide.loadPackagesFromImports(python);
  // Get libWiiPy
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  // THIS IS A TEMPORARY DOWNLOAD LOCATION BECAUSE I NEED A MODIFIED LWP BUILD
  // TODO: MERGE THESE CHANGES INTO MAIN AND GET v0.6.0 OUT
  await micropip.install(`https://cdn.ncxprogramming.com/file/internal/libWiiPy-0.6.0-py3-none-any.whl`);
  // make a Python dictionary with the data from `context`
  const dict = pyodide.globals.get("dict");
  const globals = dict(Object.entries(context));
  // Callback func
  globals.set("send_message", (msg) => {
    self.postMessage({ id, update: msg });
  });
  try {
    // Execute the python code in this context
    let result = await pyodide.runPythonAsync(python, { globals });
    // If we got bytes, convert to base64 for JS reasons
    result = result.toJs();
    if (result instanceof Uint8Array) {
      console.log("Encoding bytes as base64");
      result = await bytesToBase64(result);
      console.log("encoded");
    }
    self.postMessage({ result, id });
  } catch (error) {
    self.postMessage({ error: error.message, id });
  }
};
