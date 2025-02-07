// workerApi.js
const pyodideWorker = new Worker("/scripts/webworker.js", { type: "module" });

function getPromiseAndResolve() {
  let resolve;
  let promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// Each message needs a unique id to identify the response. In a real example,
// we might use a real uuid package
let lastId = 1;
function getId() {
  return lastId++;
}

// Register callback handlers
let updateCallback = null;
export function setUpdateCallback(callback) {
  updateCallback = callback;
}

// Add an id to msg, send it to worker, then wait for a response with the same id.
// When we get such a response, use it to resolve the promise.
function requestResponse(worker, msg) {
  const { promise, resolve } = getPromiseAndResolve();
  const idWorker = getId();

  worker.addEventListener("message", function listener(event) {
    if (event.data?.id !== idWorker) {
      return;
    }
    if (event.data.update && updateCallback) {
      updateCallback(event.data.update); // Handle UI update
      return;
    }
    // This listener is done so remove it.
    worker.removeEventListener("message", listener);
    // Filter the id out of the result
    const { id, ...rest } = event.data;
    resolve(rest);
  });

  worker.postMessage({ id: idWorker, ...msg });
  return promise;
}

export function asyncRun(script, context) {
  return requestResponse(pyodideWorker, { context, python: script });
}