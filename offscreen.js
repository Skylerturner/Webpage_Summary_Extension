// offscreen.js
// Handles PDF extraction and summarization using transformers.js

import { DEBUG } from './config.js';

if (DEBUG) console.log("Offscreen.js starting to load...");

// Import transformers.js from ROOT (not from transformers/ folder)
if (DEBUG) console.log("Importing transformers.js from root...");
const { pipeline, env } = await import('./transformers.js');

if (DEBUG) console.log("Transformers.js imported successfully");

// Configure environment - WASM files are in transformers/ folder
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('transformers/');
if (DEBUG) console.log("Environment configured - WASM path:", chrome.runtime.getURL('transformers/'));

// Pipeline cache
const pipelineCache = {};

// ========================================
// Progress Updates
// ========================================

function sendProgress(progress, status) {
  if (DEBUG) console.log(`Progress: ${progress}% - ${status}`);
  chrome.runtime.sendMessage({
    type: 'summarizationProgress',
    progress,
    status
  }).catch(() => {});
}

// ========================================
// PDF Text Extraction
// ========================================

async function extractPDFText(pdfUrl) {
  try {
    if (DEBUG) console.log("[PDF] Starting extraction for:", pdfUrl);
    
    // Import PDF.js
    if (DEBUG) console.log("[PDF] Importing PDF.js...");
    const pdfjsLib = await import('./pdf-lib/pdf.mjs');
    if (DEBUG) console.log("[PDF] PDF.js imported");
    
    // Set worker path
    const workerPath = chrome.runtime.getURL('pdf-lib/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    if (DEBUG) console.log("[PDF] Worker configured");
    
    // Fetch PDF
    if (DEBUG) console.log("[PDF] Fetching PDF...");
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
    if (DEBUG) console.log(`[PDF] Downloaded: ${sizeMB} MB`);
    
    // Load PDF
    if (DEBUG) console.log("[PDF] Loading document...");
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    if (DEBUG) console.log(`[PDF] Loaded: ${pdf.numPages} pages`);
    
    // Extract text from all pages
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
      
      if (pageNum % 10 === 0) {
        if (DEBUG) console.log(`[PDF] Processed ${pageNum}/${pdf.numPages} pages`);
      }
    }
    
    if (DEBUG) console.log(`[PDF] COMPLETE: ${fullText.length} characters`);
    return fullText.trim();
    
  } catch (error) {
    if (DEBUG) console.error("[PDF] Failed:", error);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

// ========================================
// Text Summarization
// ========================================

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

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

/**
 * Calculate appropriate summary length based on input length
 * Uses hybrid approach: dynamic scaling with tiered bounds
 */
function calculateSummaryLength(inputTokens) {
  // Base calculation: aim for 18% of input length
  let targetLength = Math.floor(inputTokens * 0.18);
  
  // Apply tiered caps based on article length
  if (inputTokens < 500) {
    // Short articles (< 2000 chars): 40-120 tokens
    targetLength = Math.max(40, Math.min(targetLength, 120));
  } else if (inputTokens < 2000) {
    // Medium articles (2000-8000 chars): 120-250 tokens
    targetLength = Math.max(120, Math.min(targetLength, 250));
  } else if (inputTokens < 5000) {
    // Long articles (8000-20000 chars): 250-400 tokens
    targetLength = Math.max(250, Math.min(targetLength, 400));
  } else {
    // Very long articles (>20000 chars): 400-600 tokens
    targetLength = Math.max(400, Math.min(targetLength, 600));
  }
  
  return {
    max_length: targetLength,
    min_length: Math.floor(targetLength * 0.4)
  };
}

async function summarizeChunk(text, model, summaryLengths = null) {
  if (!pipelineCache[model]) {
    sendProgress(15, `Loading model ${model}...`);
    
    try {
      pipelineCache[model] = await pipeline("summarization", model, { 
        device: "webgpu"
      });
      if (DEBUG) console.log("Using WebGPU acceleration");
    } catch (e) {
      if (DEBUG) console.log("WebGPU unavailable, using WASM");
      pipelineCache[model] = await pipeline("summarization", model);
    }
    
    sendProgress(50, "Model ready!");
  }

  const summarizer = pipelineCache[model];
  let inputText = model.includes("t5") ? "summarize: " + text : text;

  // Calculate summary length if not provided
  if (!summaryLengths) {
    const inputTokens = estimateTokens(text);
    summaryLengths = calculateSummaryLength(inputTokens);
  }

  sendProgress(60, "Generating summary...");
  const result = await summarizer(inputText, { 
    max_length: summaryLengths.max_length, 
    min_length: summaryLengths.min_length, 
    do_sample: false 
  });
  return result[0].summary_text;
}

async function summarizeWithTransformersJS(text, model = "distilbart-cnn-12-6") {
  const tokens = estimateTokens(text);
  
  if (tokens > 5000) {
    sendProgress(5, `Large article (${tokens} tokens)...`);
  }
  
  const maxTokens = model.includes("bart") ? 512 : 400;

  // For short articles, use dynamic length calculation
  if (tokens < maxTokens * 0.8) {
    const summaryLengths = calculateSummaryLength(tokens);
    if (DEBUG) console.log(`Short article: ${tokens} tokens -> summary ${summaryLengths.min_length}-${summaryLengths.max_length} tokens`);
    return await summarizeChunk(text, model, summaryLengths);
  }

  // For long articles, summarize in chunks
  const chunks = chunkText(text, Math.floor(maxTokens * 0.8));
  sendProgress(10, `Processing ${chunks.length} chunks...`);

  const summaries = [];
  for (let i = 0; i < chunks.length; i++) {
    sendProgress(10 + ((i / chunks.length) * 50), `Chunk ${i + 1}/${chunks.length}...`);
    // Use moderate summary length for individual chunks
    const chunkSummaryLength = { max_length: 150, min_length: 60 };
    const summary = await summarizeChunk(chunks[i], model, chunkSummaryLength);
    summaries.push(summary);
  }

  let currentSummaries = summaries;
  let iteration = 1;
  
  while (currentSummaries.length > 1) {
    sendProgress(60 + (iteration * 10), `Combining summaries (round ${iteration})...`);
    
    const combined = currentSummaries.join(" ");
    const combinedTokens = estimateTokens(combined);
    
    if (combinedTokens < maxTokens * 0.8) {
      sendProgress(85, "Creating final summary...");
      // Use dynamic length for final summary based on ORIGINAL article length
      const finalSummaryLengths = calculateSummaryLength(tokens);
      if (DEBUG) console.log(`Final summary: ${tokens} original tokens -> ${finalSummaryLengths.min_length}-${finalSummaryLengths.max_length} tokens`);
      return await summarizeChunk(combined, model, finalSummaryLengths);
    }
    
    const groupSize = 5;
    const nextRoundSummaries = [];
    
    for (let i = 0; i < currentSummaries.length; i += groupSize) {
      const group = currentSummaries.slice(i, i + groupSize);
      const groupText = group.join(" ");
      
      if (estimateTokens(groupText) > maxTokens * 0.8) {
        // Use moderate length for intermediate summaries
        const intermediateSummaryLength = { max_length: 180, min_length: 70 };
        const groupSummary = await summarizeChunk(groupText, model, intermediateSummaryLength);
        nextRoundSummaries.push(groupSummary);
      } else {
        nextRoundSummaries.push(groupText);
      }
    }
    
    currentSummaries = nextRoundSummaries;
    iteration++;
    
    if (iteration > 5) {
      if (DEBUG) console.warn("Max iterations reached");
      return "SUMMARY (Multi-part):\n\n" + currentSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join("\n\n");
    }
  }

  return currentSummaries[0];
}

// ========================================
// Message Listener
// ========================================

if (DEBUG) console.log("Setting up message listener...");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (DEBUG) console.log("Received:", message.action);
  
  // Ping handler - responds when offscreen is ready
  if (message.action === "ping") {
    if (DEBUG) console.log("Ping received, responding ready");
    sendResponse({ ready: true });
    return true;
  }
  
  if (message.action === "extractPDF") {
    if (DEBUG) console.log("Starting PDF extraction...");
    
    (async () => {
      try {
        const text = await extractPDFText(message.pdfUrl);
        if (DEBUG) console.log(`Sending ${text.length} characters back`);
        sendResponse({ success: true, text });
      } catch (error) {
        if (DEBUG) console.error("Error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
  
  if (message.action === "summarizeWithTransformers") {
    if (DEBUG) console.log("Starting summarization...");
    
    (async () => {
      try {
        const summary = await summarizeWithTransformersJS(message.text, message.model);
        sendProgress(100, "Complete!");
        sendResponse({ success: true, summary });
      } catch (error) {
        if (DEBUG) console.error("Error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
  
  return false;
});

if (DEBUG) console.log("Offscreen document ready");