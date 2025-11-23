// background.js
// Handles LLM API calls and messages from popup.js with smart chunking

import { STOPWORDS, POSITIVE_WORDS, NEGATIVE_WORDS, SUBJECTIVE_WORDS } from './nlp-dict.js';

// ========================================
// Offscreen Document Management
// ========================================

let offscreenCreating; // Promise to track offscreen document creation

async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    return;
  }

  // If already creating, wait for that to finish
  if (offscreenCreating) {
    await offscreenCreating;
  } else {
    // Create offscreen document
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run transformers.js for local AI summarization'
    });

    await offscreenCreating;
    offscreenCreating = null;
  }
}

// ========================================
// Token & Chunking Helpers
// ========================================

function estimateTokens(text) {
  // More accurate estimation accounting for word density
  const words = text.match(/\w+/g) || [];
  // Average: 1 token per word, plus punctuation/spaces
  return Math.ceil(words.length * 1.3);
}

function chunkText(text, maxTokensPerChunk = 2000) {
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
// API Summarization Functions
// ========================================

async function summarizeOpenAI(text, apiKey, model = "gpt-4o-mini") {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { 
            role: "system", 
            content: "You are a helpful assistant that creates concise, accurate summaries of articles. Focus on the main points and key information."
          },
          { 
            role: "user", 
            content: `Please provide a concise summary of the following article:\n\n${text}`
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No summary generated.";
  } catch (err) {
    console.error("OpenAI summarization error:", err);
    throw err;
  }
}

async function summarizeClaude(text, apiKey, model = "claude-3-haiku-20240307") {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `Please provide a concise, well-structured summary of the following article. Focus on the main points and key takeaways:\n\n${text}`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "No summary generated.";
  } catch (err) {
    console.error("Claude summarization error:", err);
    throw err;
  }
}

async function summarizeOllama(text, model = "llama-2-7b") {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: `Please provide a concise summary of the following article. Focus on the main points:\n\n${text}\n\nSummary:`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.response || "No summary generated.";
  } catch (err) {
    console.error("Ollama summarization error:", err);
    throw new Error("Ollama error: " + err.message + ". Make sure Ollama is running on localhost:11434");
  }
}

async function summarizeWithTransformers(text, model = "distilbart-cnn-12-6") {
  try {
    // Ensure offscreen document is ready
    await ensureOffscreenDocument();

    // Send message to offscreen document (it handles chunking internally)
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "summarizeWithTransformers", text, model },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve(response.summary);
          } else {
            reject(new Error(response?.error || "Summarization failed"));
          }
        }
      );
    });
  } catch (err) {
    console.error("Transformers.js summarization failed:", err);
    throw err;
  }
}

// ========================================
// Smart Long-Text Summarization
// ========================================

async function summarizeLongText(text, provider, apiKey, model) {
  const tokens = estimateTokens(text);
  console.log(`Article length: ${tokens} tokens`);

  // Token limits by provider (conservative estimates)
  const providerLimits = {
    "transformers.js": 512, // Handled by offscreen.js
    "Ollama": 2500,
    "openai": 8000,  // Most OpenAI models can handle more, but we chunk for cost efficiency
    "claude": 8000   // Claude can handle much more, but chunking saves tokens
  };

  const limit = providerLimits[provider] || 2500;

  // For transformers.js, let offscreen.js handle chunking
  if (provider === "transformers.js") {
    return await summarizeWithTransformers(text, model);
  }

  // If text is short enough, summarize directly
  if (tokens < limit * 0.8) {
    return await summarizeDirect(text, provider, apiKey, model);
  }

  // For long text, use chunking strategy
  console.log(`Long article detected (${tokens} tokens). Chunking for ${provider}...`);
  const chunks = chunkText(text, Math.floor(limit * 0.7));
  console.log(`Split into ${chunks.length} chunks`);

  // Summarize each chunk
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Summarizing chunk ${i + 1}/${chunks.length}`);
    const summary = await summarizeDirect(chunks[i], provider, apiKey, model);
    chunkSummaries.push(summary);
  }

  // If we got multiple summaries, combine and summarize again
  if (chunkSummaries.length > 1) {
    const combined = chunkSummaries.join("\n\n");
    
    // If combined summaries are still too long, return them formatted
    if (estimateTokens(combined) > limit * 0.8) {
      return "SUMMARY OF LONG ARTICLE (in parts):\n\n" + 
             chunkSummaries.map((s, i) => `Part ${i + 1}:\n${s}`).join("\n\n---\n\n");
    }
    
    // Otherwise, create a final summary of summaries
    console.log("Creating final summary from chunk summaries...");
    const finalPrompt = `The following are summaries of different parts of an article. Please combine them into one cohesive summary:\n\n${combined}`;
    return await summarizeDirect(finalPrompt, provider, apiKey, model);
  }

  return chunkSummaries[0];
}

async function summarizeDirect(text, provider, apiKey, model) {
  switch (provider) {
    case "transformers.js":
      return await summarizeWithTransformers(text, model);
    case "Ollama":
      return await summarizeOllama(text, model);
    case "openai":
      return await summarizeOpenAI(text, apiKey, model);
    case "claude":
      return await summarizeClaude(text, apiKey, model);
    default:
      throw new Error("Unknown provider: " + provider);
  }
}

// ========================================
// NLP Computation
// ========================================

function computeNLP(text) {
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const wordCount = words.length;
  const readingTime = Math.ceil(wordCount / 200) + " min";

  // Count word frequencies (excluding stopwords)
  const freq = {};
  words.forEach(w => {
    const lw = w.toLowerCase().replace(/[^a-z0-9]/g, ''); // Remove punctuation
    if (lw.length > 2 && !STOPWORDS.has(lw)) { // Ignore 1-2 letter words
      freq[lw] = (freq[lw] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(x => x[0])
    .join(", ");

  let sentimentScore = 0;
  let subjectivityScore = 0;

  words.forEach(w => {
    const lw = w.toLowerCase().replace(/[^a-z]/g, '');
    if (POSITIVE_WORDS.has(lw)) sentimentScore += 1;
    if (NEGATIVE_WORDS.has(lw)) sentimentScore -= 1;
    if (SUBJECTIVE_WORDS.has(lw)) subjectivityScore += 1;
  });

  subjectivityScore = +(subjectivityScore / wordCount).toFixed(2);

  return { wordCount, readingTime, topKeywords, sentimentScore, subjectivityScore };
}

// ========================================
// Message Listener
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, provider, model, apiKey, text } = message;

  if (action === "generateSummary") {
    summarizeLongText(text, provider, apiKey, model)
      .then(summary => sendResponse({ success: true, summary }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));

    return true; // Keep channel open for async response
  }

  if (action === "computeNLP") {
    const nlp = computeNLP(text);
    sendResponse(nlp);
    return true;
  }
});