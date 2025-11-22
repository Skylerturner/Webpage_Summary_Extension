// popup.js
document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements
  const wordCountEl = document.getElementById("wordCount");
  const sentenceCountEl = document.getElementById("sentenceCount");
  const readingTimeEl = document.getElementById("readingTime");
  const tokenEstimateEl = document.getElementById("tokenEstimate");
  const mostUsedWordEl = document.getElementById("mostUsedWord");

  const toggleEl = document.getElementById("enableExtraction");
  const providerEl = document.getElementById("providerSelect");
  const apiKeyEl = document.getElementById("apiKey");
  const generateBtn = document.getElementById("generateSummary");
  const summaryEl = document.getElementById("summary");

  // --------------------
  // Load saved settings
  // --------------------
  chrome.storage.sync.get(["enableExtraction"], (result) => {
    toggleEl.checked = result.enableExtraction ?? true;
  });

  toggleEl.addEventListener("change", () => {
    chrome.storage.sync.set({ enableExtraction: toggleEl.checked });
  });

  chrome.storage.sync.get(["selectedProvider", "apiKey"], (result) => {
    providerEl.value = result.selectedProvider || "huggingface";
    apiKeyEl.value = result.apiKey || "";
  });

  providerEl.addEventListener("change", () => {
    chrome.storage.sync.set({ selectedProvider: providerEl.value });
  });

  apiKeyEl.addEventListener("input", () => {
    chrome.storage.sync.set({ apiKey: apiKeyEl.value });
  });

  // --------------------
  // Load article NLP insights
  // --------------------
  chrome.storage.local.get(["article"], (data) => {
    if (data.article?.insights) {
      const insights = data.article.insights;
      wordCountEl.textContent = insights.wordCount;
      sentenceCountEl.textContent = insights.sentenceCount;
      readingTimeEl.textContent = insights.readingTime + " min";
      tokenEstimateEl.textContent = insights.tokenEstimate;
      mostUsedWordEl.textContent = insights.mostUsedWord;
    } else {
      wordCountEl.textContent = "-";
      sentenceCountEl.textContent = "-";
      readingTimeEl.textContent = "-";
      tokenEstimateEl.textContent = "-";
      mostUsedWordEl.textContent = "-";
    }
  });

  // --------------------
  // Generate summary
  // --------------------
  generateBtn.addEventListener("click", () => {
    chrome.storage.local.get(["article"], (data) => {
      if (!data.article?.originalText) {
        summaryEl.textContent = "No article text available.";
        return;
      }

      const text = data.article.originalText;

      chrome.storage.sync.get(["selectedProvider", "apiKey"], (settings) => {
        const provider = settings.selectedProvider || "huggingface";
        const apiKey = settings.apiKey || "";

        // Send message to background to generate summary
        chrome.runtime.sendMessage(
          {
            action: "generateSummary",
            text,
            provider,
            apiKey
          },
          (response) => {
            if (response?.success) {
              summaryEl.textContent = response.summary;
            } else {
              summaryEl.textContent =
                "Error generating summary: " + (response?.error || "Unknown");
            }
          }
        );
      });
    });
  });
});
