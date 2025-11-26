// background.js
// Handles summarization requests and NLP computation

import { STOPWORDS, POSITIVE_WORDS, NEGATIVE_WORDS, SUBJECTIVE_WORDS } from './nlp-dict.js';
import { extractPDFText } from './pdf-helper.js';

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
// Summarization with Transformers.js
// ========================================

async function summarizeWithTransformers(text, model = "Xenova/distilbart-cnn-6-6") {
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
  const { action } = message;

  if (action === "extractPDF") {
    extractPDFText(message.pdfUrl)
      .then(text => sendResponse({ success: true, text }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    
    return true; // Keep channel open for async response
  }

  if (action === "generateSummary") {
    summarizeWithTransformers(message.text, message.model)
      .then(summary => sendResponse({ success: true, summary }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));

    return true; // Keep channel open for async response
  }

  if (action === "computeNLP") {
    const nlp = computeNLP(message.text);
    sendResponse(nlp);
    return true;
  }
});