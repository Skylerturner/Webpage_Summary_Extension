// Debug flag - set to true for development logging
// DEBUG is imported from config.js

// Import configuration constants
import { MODEL_ID, MODEL_DISPLAY_NAME, DEBUG, PDF_EXTRACTION_TIMEOUT, SUMMARIZATION_TIMEOUT, NLP_TIMEOUT, CONTENT_SCRIPT_TIMEOUT, MAX_NLP_TEXT_LENGTH } from '../config.js';

document.addEventListener("DOMContentLoaded", async () => {
  if (DEBUG) console.log("Popup loaded");

  // --------------------
  // UI Elements
  // --------------------
  const wordCountEl = document.getElementById("wordCount");
  const readingTimeEl = document.getElementById("readingTime");
  const topKeywordsEl = document.getElementById("topKeywords");
  const sentimentScoreEl = document.getElementById("sentimentScore");
  const subjectivityScoreEl = document.getElementById("subjectivityScore");
  const sentimentLabelEl = document.getElementById("sentimentLabel");
  const subjectivityLabelEl = document.getElementById("subjectivityLabel");

  const analyzeBtn = document.getElementById("analyzeBtn");
  const generateBtn = document.getElementById("generateSummary");
  const summaryEl = document.getElementById("summary");

  // Hardcoded model
  const MODEL = MODEL_ID;

  // Progress bar elements
  const progressSection = document.getElementById("progressSection");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  if (DEBUG) console.log("All UI elements found");

  // --------------------
  // Progress Bar Functions
  // --------------------
  function showProgress(percent, message) {
    progressSection.classList.remove("hidden");
    
    if (percent === null) {
      progressBar.classList.add("loading");
      progressBar.style.width = "100%";
    } else {
      progressBar.classList.remove("loading");
      progressBar.style.width = percent + "%";
    }
    
    progressText.textContent = message;
  }

  function hideProgress() {
    progressSection.classList.add("hidden");
    progressBar.classList.remove("loading");
    progressBar.style.width = "0%";
  }

  // Listen for progress updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'summarizationProgress') {
      showProgress(message.progress, message.status);
    }
  });

  // --------------------
  // Helper Functions
  // --------------------
  function getSentimentLabel(score) {
    if (score > 5) return { text: "(very positive)", className: "positive" };
    if (score > 2) return { text: "(positive)", className: "positive" };
    if (score > 0) return { text: "(slightly positive)", className: "positive" };
    if (score === 0) return { text: "(neutral)", className: "neutral" };
    if (score > -2) return { text: "(slightly negative)", className: "negative" };
    if (score > -5) return { text: "(negative)", className: "negative" };
    return { text: "(very negative)", className: "negative" };
  }

  function getSubjectivityLabel(score) {
    if (score > 0.15) return { text: "(highly subjective/opinion-based)", className: "neutral" };
    if (score > 0.08) return { text: "(somewhat subjective)", className: "neutral" };
    if (score > 0.03) return { text: "(mostly objective)", className: "neutral" };
    return { text: "(objective/factual)", className: "neutral" };
  }

  // --------------------
  // Improved Message Sending
  // --------------------
  
  function sendMessageWithTimeout(message, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs/1000}s`));
      }, timeoutMs);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // --------------------
  // Get Text from Active Tab
  // --------------------
  
  async function getTextFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (DEBUG) console.log("Getting text from tab:", tab.url);
    
    // Check if this is a restricted page
    const restrictedPages = [
      'chrome://', 'chrome-extension://', 'edge://', 'about:', 
      'data:', 'view-source:', 'chrome.google.com/webstore'
    ];
    
    if (restrictedPages.some(prefix => tab.url.startsWith(prefix))) {
      throw new Error("Cannot run on this page. Please navigate to a regular website or PDF.");
    }
    
    // Helper to send message to content script
    const sendToContentScript = () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("TIMEOUT"));
        }, CONTENT_SCRIPT_TIMEOUT);

        chrome.tabs.sendMessage(tab.id, { action: "extractText" }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    };
    
    // Try to get text from content script
    let response;
    try {
      response = await sendToContentScript();
    } catch (error) {
      // If content script not loaded, try injecting it
      if (error.message.includes("Receiving end does not exist")) {
        if (DEBUG) console.log("Content script not found, injecting...");
        
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          
          await new Promise(resolve => setTimeout(resolve, 100));
          if (DEBUG) console.log("Retrying after injection...");
          response = await sendToContentScript();
        } catch (injectError) {
          throw new Error("Content script failed to load. Please reload the page and try again.");
        }
      } else {
        throw error;
      }
    }
    
    if (DEBUG) console.log("Content script response:", response?.source);
    
    // Handle PDF extraction
    if (response?.pdfUrl) {
      if (DEBUG) console.log("PDF detected, requesting extraction...");
      
      const pdfResponse = await sendMessageWithTimeout(
        { action: "extractPDF", pdfUrl: response.pdfUrl },
        PDF_EXTRACTION_TIMEOUT
      );
      
      if (pdfResponse?.success) {
        if (DEBUG) console.log("PDF text received:", pdfResponse.text.length, "characters");
        return {
          text: pdfResponse.text,
          textForSummary: pdfResponse.text,
          source: "PDF"
        };
      } else {
        throw new Error(pdfResponse?.error || "PDF extraction failed");
      }
    }
    
    // Handle regular text extraction
    if (!response?.text) {
      throw new Error("No text extracted from page");
    }
    
    if (DEBUG) console.log("Extracted:", response.text.length, "characters");
    return response;
  }


  // --------------------
  // ANALYZE Button
  // --------------------
  
  analyzeBtn.addEventListener("click", async () => {
    try {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = "Analyzing...";
      
      if (DEBUG) console.log("Starting analysis...");
      
      // Show progress for PDFs
      showProgress(null, "Extracting text...");

      const response = await getTextFromActiveTab();
      
      if (DEBUG) console.log("Text extracted, length:", response.text.length);
      
      // For very large texts (like PDFs), truncate to first 50,000 characters for NLP
      // This prevents timeouts while still being representative
      let textForNLP = response.text;
      if (textForNLP.length > MAX_NLP_TEXT_LENGTH) {
        if (DEBUG) console.log("Text too long, truncating to 50k characters for NLP analysis");
        textForNLP = textForNLP.substring(0, MAX_NLP_TEXT_LENGTH);
      }
      
      showProgress(50, "Computing NLP metrics...");
      
      if (DEBUG) console.log("Sending to NLP, length:", textForNLP.length);

      // Longer timeout for NLP on large texts
      const nlp = await sendMessageWithTimeout(
        { action: "computeNLP", text: textForNLP },
        NLP_TIMEOUT  // 30 seconds for NLP
      );
      
      hideProgress();
      
      if (DEBUG) console.log("NLP results:", nlp);
      
      if (!nlp || nlp.error) {
        throw new Error(nlp?.error || "NLP computation failed");
      }

      wordCountEl.textContent = nlp.wordCount;
      readingTimeEl.textContent = nlp.readingTime;
      topKeywordsEl.textContent = nlp.topKeywords;
      sentimentScoreEl.textContent = nlp.sentimentScore;
      subjectivityScoreEl.textContent = nlp.subjectivityScore;

      // Add context labels
      const sentimentLabel = getSentimentLabel(nlp.sentimentScore);
      sentimentLabelEl.textContent = sentimentLabel.text;
      sentimentLabelEl.className = "context-label " + sentimentLabel.className;

      const subjectivityLabel = getSubjectivityLabel(nlp.subjectivityScore);
      subjectivityLabelEl.textContent = subjectivityLabel.text;
      subjectivityLabelEl.className = "context-label " + subjectivityLabel.className;
      
    } catch (err) {
      if (DEBUG) console.error("Analyze error:", err);
      hideProgress();
      wordCountEl.textContent = "Error";
      readingTimeEl.textContent = "-";
      topKeywordsEl.textContent = err.message;
      sentimentScoreEl.textContent = "-";
      subjectivityScoreEl.textContent = "-";
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analyze";
    }
  });

  // --------------------
  // SUMMARIZE Button
  // --------------------
  
  generateBtn.addEventListener("click", async () => {
    try {
      generateBtn.disabled = true;
      generateBtn.textContent = "Summarizing...";
      summaryEl.textContent = "Processing...";
      
      if (DEBUG) console.log("Starting summarization...");
      
      showProgress(5, "Extracting article text...");

      // Extract text from current tab
      const response = await getTextFromActiveTab();
      
      const text = response.textForSummary;
      
      if (DEBUG) console.log("Sending to summarizer, length:", text.length);

      showProgress(8, "Initializing AI model...");

      // Send to background for summarization (give it 3 minutes for large PDFs)
      const summaryResponse = await sendMessageWithTimeout(
        { action: "generateSummary", text: text, model: MODEL },
        SUMMARIZATION_TIMEOUT  // 3 minutes
      );
      
      if (DEBUG) console.log("Summarization complete");
      
      hideProgress();
      
      if (summaryResponse?.success) {
        summaryEl.textContent = summaryResponse.summary;
      } else {
        summaryEl.textContent = "Error: " + (summaryResponse?.error || "Unknown error");
      }
      
    } catch (err) {
      if (DEBUG) console.error("Summarize error:", err);
      hideProgress();
      summaryEl.textContent = "Error: " + err.message;
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Summarize";
    }
  });
  
  if (DEBUG) console.log("Popup ready");
});