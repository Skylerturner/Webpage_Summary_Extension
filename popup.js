// popup.js
document.addEventListener("DOMContentLoaded", async () => {
  // --------------------
  // UI Elements
  // --------------------
  const wordCountEl = document.getElementById("wordCount");
  const readingTimeEl = document.getElementById("readingTime");
  const topKeywordsEl = document.getElementById("topKeywords");
  const sentimentScoreEl = document.getElementById("sentimentScore");
  const subjectivityScoreEl = document.getElementById("subjectivityScore");

  const sourceSelect = document.getElementById("sourceSelect");
  const providerSection = document.getElementById("providerSection");
  const providerSelect = document.getElementById("providerSelect");
  const apiKeySection = document.getElementById("apiKeySection");
  const apiKeyEl = document.getElementById("apiKey");
  const localSection = document.getElementById("localSection");
  const localBackendSelect = document.getElementById("localBackendSelect");
  const modelSelect = document.getElementById("modelSelect");

  const analyzeBtn = document.getElementById("analyzeBtn");
  const generateBtn = document.getElementById("generateSummary");
  const summaryEl = document.getElementById("summary");

  // --------------------
  // Available models
  // --------------------
  const defaultModels = ["distilbart-cnn-12-6", "t5-small", "t5-base"]; // bundled transformers.js
  const localBackends = {
    "Ollama": [
      "llama-2-7b", "llama-2-13b",
      "gemma3:4b", "gemma3:1b",
      "mistral-7b", "qwen3:4b", "deepseek-r1:8b"
    ]
  };
  const personalProviders = {
    openai: ["gpt-4", "gpt-3.5-turbo", "gpt-4o-mini"],
    claude: ["claude-v1", "claude-instant"],
    gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
  };

  // --------------------
  // Helper to populate select dropdown
  // --------------------
  function populateSelect(selectEl, options) {
    selectEl.innerHTML = "";
    options.forEach(opt => {
      const el = document.createElement("option");
      el.value = opt;
      el.textContent = opt;
      selectEl.appendChild(el);
    });
  }

  // --------------------
  // Update model dropdown based on source
  // --------------------
  function updateModelDropdown() {
    const source = sourceSelect.value;
    let models = [];

    if (source === "Default") {
      models = defaultModels;
    } else if (source === "Local") {
      const backend = localBackendSelect.value;
      models = localBackends[backend] || [];
    } else if (source === "Online") {
      const provider = providerSelect.value;
      models = personalProviders[provider] || [];
    }

    populateSelect(modelSelect, models);
  }

  // --------------------
  // Update UI visibility based on source
  // --------------------
  function updateUI() {
    const source = sourceSelect.value;

    if (source === "Default") {
      providerSection.style.display = "none";
      apiKeySection.style.display = "none";
      localSection.style.display = "none";
    } else if (source === "Local") {
      providerSection.style.display = "none";
      apiKeySection.style.display = "none";
      localSection.style.display = "block";
      populateSelect(localBackendSelect, Object.keys(localBackends));
    } else if (source === "Online") {
      providerSection.style.display = "block";
      apiKeySection.style.display = "block";
      localSection.style.display = "none";
      populateSelect(providerSelect, Object.keys(personalProviders));
    }

    updateModelDropdown();
  }

  // --------------------
  // Initialize UI
  // --------------------
  sourceSelect.addEventListener("change", updateUI);
  providerSelect.addEventListener("change", updateModelDropdown);
  localBackendSelect.addEventListener("change", updateModelDropdown);
  updateUI();

  // --------------------
  // Load saved API key and provider
  // --------------------
  chrome.storage.sync.get(["selectedProvider", "apiKey"], (result) => {
    providerSelect.value = result.selectedProvider || "openai";
    apiKeyEl.value = result.apiKey || "";
  });

  providerSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ selectedProvider: providerSelect.value });
  });

  apiKeyEl.addEventListener("input", () => {
    chrome.storage.sync.set({ apiKey: apiKeyEl.value });
  });

  // --------------------
  // Analyze button
  // --------------------
  analyzeBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "extractText" }, (response) => {
      if (!response?.text) {
        wordCountEl.textContent = "-";
        readingTimeEl.textContent = "-";
        topKeywordsEl.textContent = "-";
        sentimentScoreEl.textContent = "-";
        subjectivityScoreEl.textContent = "-";
        return;
      }

      chrome.runtime.sendMessage({ action: "computeNLP", text: response.text }, (nlp) => {
        if (!nlp) return;

        wordCountEl.textContent = nlp.wordCount;
        readingTimeEl.textContent = nlp.readingTime;
        topKeywordsEl.textContent = nlp.topKeywords;
        sentimentScoreEl.textContent = nlp.sentimentScore;
        subjectivityScoreEl.textContent = nlp.subjectivityScore;

        chrome.storage.local.set({ nlp });
      });
    });
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
      const source = sourceSelect.value;
      let provider = null;
      let apiKey = null;
      const model = modelSelect.value;

      if (source === "Default") {
        provider = "transformers.js";
      } else if (source === "Local") {
        provider = "Ollama";
      } else if (source === "Online") {
        provider = providerSelect.value;
        apiKey = apiKeyEl.value;
      }

      chrome.runtime.sendMessage({ action: "generateSummary", text, provider, apiKey, model }, (response) => {
        if (response?.success) {
          summaryEl.textContent = response.summary;
        } else {
          summaryEl.textContent = "Error generating summary: " + (response?.error || "Unknown");
        }
      });
    });
  });
});
