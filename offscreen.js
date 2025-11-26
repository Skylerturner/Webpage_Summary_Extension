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

// Main summarization function with iterative reduction for long documents
async function summarizeWithTransformersJS(text, model = "distilbart-cnn-12-6") {
  const tokens = estimateTokens(text);
  
  // Warn for very large articles
  if (tokens > 5000) {
    sendProgress(5, `Large article (${tokens} tokens) - this may take several minutes...`);
  }
  
  // Use smaller context for better memory management
  const maxTokens = model.includes("bart") ? 512 : 400;

  // If text fits in one chunk, summarize directly
  if (tokens < maxTokens * 0.8) {
    return await summarizeChunk(text, model);
  }

  // Split into chunks
  const chunks = chunkText(text, Math.floor(maxTokens * 0.8));
  sendProgress(10, `Processing ${chunks.length} chunks...`);

  // Summarize each chunk
  const summaries = [];
  for (let i = 0; i < chunks.length; i++) {
    sendProgress(10 + ((i / chunks.length) * 50), `Summarizing chunk ${i + 1}/${chunks.length}...`);
    const summary = await summarizeChunk(chunks[i], model);
    summaries.push(summary);
  }

  // Iteratively reduce summaries until we have a manageable size
  let currentSummaries = summaries;
  let iteration = 1;
  
  while (currentSummaries.length > 1) {
    sendProgress(60 + (iteration * 10), `Combining summaries (round ${iteration})...`);
    
    // Combine summaries and estimate tokens
    const combined = currentSummaries.join(" ");
    const combinedTokens = estimateTokens(combined);
    
    // If combined summaries fit in one chunk, do final summarization
    if (combinedTokens < maxTokens * 0.8) {
      sendProgress(85, "Creating final summary...");
      return await summarizeChunk(combined, model);
    }
    
    // Otherwise, split into groups and summarize each group
    // Reduce by 1/5 each iteration (5 summaries -> 1 summary)
    const groupSize = 5;
    const nextRoundSummaries = [];
    
    for (let i = 0; i < currentSummaries.length; i += groupSize) {
      const group = currentSummaries.slice(i, i + groupSize);
      const groupText = group.join(" ");
      
      // Only summarize if group is too large
      if (estimateTokens(groupText) > maxTokens * 0.8) {
        const groupSummary = await summarizeChunk(groupText, model);
        nextRoundSummaries.push(groupSummary);
      } else {
        // If group is small enough, keep as is
        nextRoundSummaries.push(groupText);
      }
    }
    
    currentSummaries = nextRoundSummaries;
    iteration++;
    
    // Safety check: prevent infinite loops
    if (iteration > 5) {
      console.warn("Max iterations reached, returning multi-part summary");
      return "SUMMARY (Multi-part):\n\n" + currentSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join("\n\n");
    }
  }

  // If we end up with exactly one summary, return it
  return currentSummaries[0];
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