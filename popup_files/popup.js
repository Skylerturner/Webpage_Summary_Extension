document.addEventListener("DOMContentLoaded", async () => {

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
  const MODEL = "Xenova/distilbart-cnn-6-6";

  // Progress bar elements
  const progressSection = document.getElementById("progressSection");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  // --------------------
  // Progress Bar Functions
  // --------------------
  function showProgress(percent, message) {
    progressSection.classList.remove("hidden");
    
    if (percent === null) {
      // Indeterminate progress (pulsing animation)
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

  // Listen for progress updates from offscreen document
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

  // Helper: Get text from active tab
  async function getTextFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "extractText" }, async (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        // If it's a PDF, ask background script to extract text
        if (response?.pdfUrl) {
          console.log("PDF detected, fetching text from background script...");
          
          chrome.runtime.sendMessage(
            { action: "extractPDF", pdfUrl: response.pdfUrl },
            (pdfResponse) => {
              if (pdfResponse?.success) {
                resolve({
                  text: pdfResponse.text,
                  textForSummary: pdfResponse.text,
                  source: "PDF"
                });
              } else {
                reject(new Error(pdfResponse?.error || "PDF extraction failed"));
              }
            }
          );
          return;
        }
        
        // Regular text extraction
        if (!response?.text) {
          reject(new Error("No text extracted"));
        } else {
          resolve(response);
        }
      });
    });
  }

  // --------------------
  // ANALYZE Button
  // --------------------
  analyzeBtn.addEventListener("click", async () => {
    try {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = "Analyzing...";

      const response = await getTextFromActiveTab();

      // Send to background for NLP computation
      chrome.runtime.sendMessage(
        { action: "computeNLP", text: response.text },
        (nlp) => {
          if (!nlp) {
            wordCountEl.textContent = "-";
            readingTimeEl.textContent = "-";
            topKeywordsEl.textContent = "-";
            sentimentScoreEl.textContent = "-";
            subjectivityScoreEl.textContent = "-";
            return;
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
        }
      );
    } catch (err) {
      console.error("Analyze error:", err);
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
      
      // Show initial progress
      showProgress(5, "Extracting article text...");

      // Extract text from current tab
      const response = await getTextFromActiveTab();
      
      // Use filtered text (no references) for summarization
      const text = response.textForSummary;

      showProgress(8, "Initializing AI model...");

      // Send to background for summarization
      chrome.runtime.sendMessage(
        { action: "generateSummary", text, model: MODEL },
        (summaryResponse) => {
          hideProgress();
          
          if (summaryResponse?.success) {
            summaryEl.textContent = summaryResponse.summary;
          } else {
            summaryEl.textContent = "Error: " + (summaryResponse?.error || "Unknown error");
          }
        }
      );
    } catch (err) {
      console.error("Summarize error:", err);
      hideProgress();
      summaryEl.textContent = "Error extracting text: " + err.message;
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Summarize";
    }
  });
});