// offscreen.js
// Handles summarization using transformers.js as an ES6 module

// Import transformers.js as a module
import { pipeline, env } from './transformers.js';

console.log("Offscreen.js loaded");
console.log("✅ Transformers.js imported successfully");

// Configure environment for Chrome extension - USE LOCAL FILES
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('transformers/');  // Point to transformers subfolder
// Note: WebGPU is now enabled via device: "webgpu" parameter in pipeline() call

// Pipeline cache
const pipelineCache = {};

function sendProgress(progress, status) {
  chrome.runtime.sendMessage({
    type: 'summarizationProgress',
    progress,
    status
  }).catch(() => {});
}

// Estimate tokens for chunking
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Split text into chunks for long inputs
function chunkText(text, maxTokensPerChunk = 400) {
  const maxChars = maxTokensPerChunk * 4;
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + para).length <= maxChars) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      let sentenceChunk = "";
      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length <= maxChars) {
          sentenceChunk += sentence;
        } else {
          if (sentenceChunk) chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }
      currentChunk = sentenceChunk;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// Summarize a single chunk
async function summarizeChunk(text, model) {
  if (!pipelineCache[model]) {
    sendProgress(15, `Loading model ${model}...`);
    
    // Try WebGPU first, fall back to WASM if unavailable
    try {
      pipelineCache[model] = await pipeline("summarization", model, { 
        device: "webgpu"  // Use GPU acceleration
      });
      console.log("✅ Using WebGPU acceleration");
    } catch (e) {
      console.log("⚠️ WebGPU not available, falling back to WASM");
      pipelineCache[model] = await pipeline("summarization", model);
    }
    
    sendProgress(50, "Model ready!");
  }

  const summarizer = pipelineCache[model];
  let inputText = model.includes("t5") ? "summarize: " + text : text;

  sendProgress(60, "Generating summary...");
  const result = await summarizer(inputText, { max_length: 150, min_length: 40, do_sample: false });
  return result[0].summary_text;
}

// Main summarization function
async function summarizeWithTransformersJS(text, model = "distilbart-cnn-12-6") {
  const tokens = estimateTokens(text);
  
  // Warn for very large articles (may be slow/crash)
  if (tokens > 5000) {
    sendProgress(5, `Large article (${tokens} tokens) - this may take several minutes...`);
  }
  
  // Use smaller context for better memory management
  const maxTokens = model.includes("bart") ? 512 : 400;  // Reduced from 1024/512

  if (tokens < maxTokens * 0.8) return await summarizeChunk(text, model);

  const chunks = chunkText(text, Math.floor(maxTokens * 0.8));
  sendProgress(10, `Processing ${chunks.length} chunks...`);

  const summaries = [];
  for (let i = 0; i < chunks.length; i++) {
    sendProgress(10 + ((i / chunks.length) * 70), `Summarizing chunk ${i + 1}/${chunks.length}...`);
    const summary = await summarizeChunk(chunks[i], model);
    summaries.push(summary);
  }

  sendProgress(85, "Creating final summary...");
  const combined = summaries.join(" ");
  if (estimateTokens(combined) > maxTokens * 0.8) {
    return "SUMMARY (Multi-part):\n\n" + summaries.map((s, i) => `Part ${i + 1}: ${s}`).join("\n\n");
  }
  return await summarizeChunk(combined, model);
}

// Listen for summarization requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "summarizeWithTransformers") {
    summarizeWithTransformersJS(message.text, message.model)
      .then(summary => {
        sendProgress(100, "Complete!");
        sendResponse({ success: true, summary });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open
  }
});