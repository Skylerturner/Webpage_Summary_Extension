// offscreen.js
// Handles transformers.js summarization in offscreen document with smart chunking

console.log("Offscreen document loaded");

// Cache for loaded pipelines to avoid reloading
const pipelineCache = {};

// ========================================
// Token & Chunking Helpers
// ========================================

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function chunkText(text, maxTokensPerChunk = 400) {
  // Transformers.js models have smaller context windows
  // distilbart-cnn: ~1024 tokens, t5-small/base: ~512 tokens
  const maxChars = maxTokensPerChunk * 4;
  
  if (text.length <= maxChars) {
    return [text];
  }

  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + para).length <= maxChars) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      // If single paragraph is too long, split by sentences
      if (para.length > maxChars) {
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
        
        if (sentenceChunk) currentChunk = sentenceChunk;
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

// ========================================
// Message Listener
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "summarizeWithTransformers") {
    console.log("Received summarization request:", message.model);
    
    summarizeWithTransformersJS(message.text, message.model)
      .then(summary => {
        console.log("Summarization complete");
        sendResponse({ success: true, summary });
      })
      .catch(error => {
        console.error("Summarization error:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
});

// ========================================
// Main Summarization Function
// ========================================

async function summarizeWithTransformersJS(text, model = "distilbart-cnn-12-6") {
  if (!window.transformers) {
    throw new Error("Transformers.js library not loaded");
  }

  try {
    const tokens = estimateTokens(text);
    console.log(`Text length: ${tokens} tokens`);

    // Get model-specific token limits
    const modelLimits = {
      "distilbart-cnn-12-6": 1024,
      "t5-small": 512,
      "t5-base": 512
    };
    const maxTokens = modelLimits[model] || 512;

    // If text is short enough, summarize directly
    if (tokens < maxTokens * 0.8) { // Use 80% of limit for safety
      return await summarizeChunk(text, model);
    }

    // For long text, use chunking strategy
    console.log(`Long text detected. Chunking with limit: ${maxTokens} tokens`);
    const chunks = chunkText(text, Math.floor(maxTokens * 0.8));
    console.log(`Split into ${chunks.length} chunks`);

    // Summarize each chunk
    const chunkSummaries = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Summarizing chunk ${i + 1}/${chunks.length}`);
      const summary = await summarizeChunk(chunks[i], model);
      chunkSummaries.push(summary);
    }

    // If we have multiple summaries, combine them
    if (chunkSummaries.length > 1) {
      const combined = chunkSummaries.join(" ");
      
      // If combined is still too long, return as-is with markers
      if (estimateTokens(combined) > maxTokens * 0.8) {
        return "SUMMARY (Multi-part):\n\n" + 
               chunkSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join("\n\n");
      }
      
      // Otherwise, create final summary
      console.log("Creating final summary from chunk summaries...");
      return await summarizeChunk(combined, model);
    }

    return chunkSummaries[0];
  } catch (error) {
    console.error("Transformers.js error:", error);
    throw error;
  }
}

// ========================================
// Direct Chunk Summarization
// ========================================

async function summarizeChunk(text, model = "distilbart-cnn-12-6") {
  try {
    console.log(`Loading/using model: ${model}`);
    
    // Check if pipeline is already cached
    if (!pipelineCache[model]) {
      pipelineCache[model] = await window.transformers.pipeline("summarization", model);
      console.log(`Model ${model} loaded and cached`);
    } else {
      console.log(`Using cached model: ${model}`);
    }

    const summarizer = pipelineCache[model];

    // Model-specific parameters
    const params = {
      "distilbart-cnn-12-6": {
        max_length: 142,
        min_length: 56,
        do_sample: false
      },
      "t5-small": {
        max_length: 150,
        min_length: 40,
        do_sample: false
      },
      "t5-base": {
        max_length: 150,
        min_length: 40,
        do_sample: false
      }
    };

    const modelParams = params[model] || params["t5-small"];

    // For T5 models, add a prefix (they were trained with task prefixes)
    let inputText = text;
    if (model.includes("t5")) {
      inputText = "summarize: " + text;
    }

    console.log(`Summarizing text (${text.length} chars) with params:`, modelParams);

    // Run summarization
    const result = await summarizer(inputText, modelParams);

    return result[0].summary_text;
  } catch (error) {
    console.error("Chunk summarization error:", error);
    throw error;
  }
}