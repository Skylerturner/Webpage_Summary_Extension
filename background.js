// background.js
// Handles summarization requests and NLP computation

// Import NLP dictionary
import { STOPWORDS, SUBJECTIVITY_INDICATORS, OBJECTIVITY_INDICATORS } from './nlp-dict.js';

// ========================================
// Configuration Constants (inline)
// ========================================
const DEBUG = false;
const MIN_ARTICLE_LENGTH = 500;

// ========================================
// AFINN Sentiment Scores (loaded from CSV)
// ========================================


let AFINN_SCORES = null;

// Load AFINN sentiment scores from CSV on startup
async function loadAfinnScores() {
  if (AFINN_SCORES) return AFINN_SCORES;
  
  try {
    const response = await fetch(chrome.runtime.getURL('Afinn.csv'));
    const csvText = await response.text();
    
    const scores = new Map();
    const lines = csvText.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const [word, value] = line.split(',');
      if (word && value) {
        scores.set(word.toLowerCase(), parseInt(value));
      }
    }
    
    if (DEBUG) console.log(`Loaded ${scores.size} AFINN sentiment scores`);
    AFINN_SCORES = scores;
    return scores;
  } catch (error) {
    if (DEBUG) console.error('Failed to load AFINN scores:', error);
    AFINN_SCORES = new Map();
    return AFINN_SCORES;
  }
}

loadAfinnScores();

// ========================================
// Offscreen Document Management
// ========================================

let offscreenCreating;
let offscreenReady = false;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    if (DEBUG) console.log("Offscreen document already exists");
    return;
  }

  if (offscreenCreating) {
    if (DEBUG) console.log("Waiting for offscreen document creation...");
    await offscreenCreating;
  } else {
    if (DEBUG) console.log("Creating offscreen document...");
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run transformers.js for local AI summarization and PDF text extraction'
    });

    await offscreenCreating;
    offscreenCreating = null;
    
    // Wait for offscreen document to actually be ready
    if (DEBUG) console.log("Waiting for offscreen document to initialize...");
    await waitForOffscreenReady();
    offscreenReady = true;
    if (DEBUG) console.log("Offscreen document confirmed ready");
  }
}

// New function: Wait for offscreen document to signal it's ready
async function waitForOffscreenReady(maxWaitMs = 10000) {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkReady = () => {
      // Try to ping the offscreen document
      chrome.runtime.sendMessage(
        { action: "ping" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Not ready yet, check if we've exceeded timeout
            const elapsed = Date.now() - startTime;
            if (elapsed > maxWaitMs) {
              if (DEBUG) console.error("Offscreen document failed to initialize within timeout");
              reject(new Error("Offscreen document initialization timeout"));
            } else {
              // Try again in 100ms
              setTimeout(checkReady, 100);
            }
          } else if (response?.ready) {
            // Offscreen is ready!
            if (DEBUG) console.log(`Offscreen ready after ${Date.now() - startTime}ms`);
            resolve();
          } else {
            // Got a response but not ready yet
            setTimeout(checkReady, 100);
          }
        }
      );
    };
    
    // Start checking
    checkReady();
  });
}


// ========================================
// Summarization with Transformers.js
// ========================================

async function summarizeWithTransformers(text, model = "Xenova/distilbart-cnn-6-6") {
  try {
    if (DEBUG) console.log("Requesting summarization...");
    
    await ensureOffscreenDocument();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Summarization timed out after 3 minutes"));
      }, 180000);

      if (DEBUG) console.log("Sending summarization request to offscreen...");
      
      chrome.runtime.sendMessage(
        { action: "summarizeWithTransformers", text, model },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            if (DEBUG) console.error("Runtime error:", chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            if (DEBUG) console.log("Summarization complete");
            resolve(response.summary);
          } else {
            if (DEBUG) console.error("Summarization failed:", response?.error);
            reject(new Error(response?.error || "Summarization failed"));
          }
        }
      );
    });
  } catch (err) {
    if (DEBUG) console.error("Summarization error:", err);
    throw err;
  }
}

// ========================================
// Enhanced NLP Computation with Weighted Subjectivity
// ========================================

async function computeNLP(text) {
  const afinnScores = await loadAfinnScores();
  
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const wordCount = words.length;
  const readingTime = Math.ceil(wordCount / 200) + " min";

  // ========================================
  // KEYWORD EXTRACTION
  // ========================================
  const freq = {};
  words.forEach(w => {
    const lw = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lw.length > 2 && !STOPWORDS.has(lw)) {
      freq[lw] = (freq[lw] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(x => x[0])
    .join(", ");

  // ========================================
  // SENTIMENT ANALYSIS (using AFINN)
  // ========================================
  let sentimentScore = 0;
  
  words.forEach(w => {
    const lw = w.toLowerCase().replace(/[^a-z]/g, '');
    if (afinnScores.has(lw)) {
      sentimentScore += afinnScores.get(lw);
    }
  });

  // ========================================
  // ENHANCED SUBJECTIVITY ANALYSIS
  // ========================================
  
  // 1. Weighted lexicon score
  let subjectiveWeightedScore = 0;
  let subjectiveWordCount = 0;
  
  words.forEach(w => {
    const lw = w.toLowerCase().replace(/[^a-z]/g, '');
    if (SUBJECTIVITY_INDICATORS.has(lw)) {
      const weight = SUBJECTIVITY_INDICATORS.get(lw);
      subjectiveWeightedScore += weight;
      subjectiveWordCount++;
    }
  });
  
  // 2. Add evaluative language from AFINN (strong sentiment = subjective)
  words.forEach(w => {
    const lw = w.toLowerCase().replace(/[^a-z]/g, '');
    if (afinnScores.has(lw)) {
      const score = Math.abs(afinnScores.get(lw));
      if (score >= 3) {
        // Strong sentiment words like "hate", "love", "excellent", "terrible"
        subjectiveWeightedScore += 2;
        subjectiveWordCount++;
      } else if (score === 2) {
        // Moderate sentiment words
        subjectiveWeightedScore += 1;
        subjectiveWordCount++;
      }
    }
  });
  
  // 3. Count objective indicators (these reduce subjectivity)
  let objectiveIndicatorCount = 0;
  
  words.forEach(w => {
    const lw = w.toLowerCase().replace(/[^a-z]/g, '');
    if (OBJECTIVITY_INDICATORS.has(lw)) {
      objectiveIndicatorCount++;
    }
  });
  
  // Also count numbers as objective indicators
  const numberCount = (text.match(/\b\d+(\.\d+)?%?\b/g) || []).length;
  objectiveIndicatorCount += numberCount;
  
  // 4. Calculate final subjectivity score (0.00 to 1.00)
  // Normalize weighted subjective score
  const subjectiveSignal = (subjectiveWeightedScore / wordCount) * 100;
  
  // Normalize objective indicators
  const objectiveSignal = (objectiveIndicatorCount / wordCount) * 100;
  
  // Balance the two signals
  // Higher subjective signal and lower objective signal = more subjective
  let subjectivityScore = (subjectiveSignal - (objectiveSignal * 0.5)) / 10;
  
  // Clamp to 0-1 range
  subjectivityScore = Math.max(0, Math.min(1, subjectivityScore));
  
  // Round to 2 decimals
  subjectivityScore = +subjectivityScore.toFixed(2);
  
  if (DEBUG) console.log(`NLP Analysis: ${wordCount} words, ${subjectiveWordCount} subjective indicators, ${objectiveIndicatorCount} objective indicators`);

  return { 
    wordCount, 
    readingTime, 
    topKeywords, 
    sentimentScore: Math.round(sentimentScore), 
    subjectivityScore 
  };
}

// ========================================
// Message Listener
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  if (action === "extractPDF") {
    if (DEBUG) console.log("Received extractPDF request, forwarding to offscreen...");
    
    // Ensure offscreen document exists first
    (async () => {
      try {
        await ensureOffscreenDocument();
        
        // Forward to offscreen document
        chrome.runtime.sendMessage(
          { action: "extractPDF", pdfUrl: message.pdfUrl },
          (response) => {
            if (chrome.runtime.lastError) {
              if (DEBUG) console.error("Offscreen error:", chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              if (DEBUG) console.log("PDF extraction complete, forwarding response");
              sendResponse(response);
            }
          }
        );
      } catch (error) {
        if (DEBUG) console.error("Failed to create offscreen document:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  if (action === "generateSummary") {
    const text = message.text?.trim() || "";

    if (text.length < MIN_ARTICLE_LENGTH) {
      sendResponse({
        success: false,
        error: `Article is too short to summarize (minimum ${MIN_ARTICLE_LENGTH} characters).`
      });
      return true;
    }

    summarizeWithTransformers(text, message.model)
      .then(summary => {
        sendResponse({ success: true, summary });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }


  if (action === "computeNLP") {
    if (DEBUG) console.log("Received computeNLP request");
    computeNLP(message.text)
      .then(nlp => {
        if (DEBUG) console.log("Sending NLP results back to popup");
        sendResponse(nlp);
      })
      .catch(err => {
        if (DEBUG) console.error("Sending error back to popup:", err.message);
        sendResponse({ error: err.message });
      });
    
    return true;
  }
  
  return false; // Important: return false for unhandled messages
});

if (DEBUG) console.log("Background service worker ready");