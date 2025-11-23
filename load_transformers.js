// load_transformers.js
// Load transformers.js from CDN in a CSP-safe way

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Expose globally for offscreen.js
window.transformers = { pipeline, env };
console.log("✅ Transformers.js loaded from CDN");

// Configure environment for Chrome extension
if (window.transformers.env) {
  window.transformers.env.allowLocalModels = false;
  window.transformers.env.allowRemoteModels = true;
  window.transformers.env.backends.onnx.wasm.numThreads = 1;
}
