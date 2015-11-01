importScripts('webgl.js'); 

onmessage = function(e) {
    var message = workerFunc(e);
    postMessage(message, createTransferList(message));
}