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
  const reduceStopwordsCheckbox = document.getElementById("reduceStopwords");

  // --------------------
  // Model Options
  // --------------------
  const defaultModels = ["distilbart-cnn-12-6", "t5-small", "t5-base"];

  const localBackends = {
    Ollama: [
      "llama-2-7b", "llama-2-13b",
      "gemma3:4b", "gemma3:1b",
      "mistral-7b", "qwen3:4b", "deepseek-r1:8b"
    ]
  };

  const personalProviders = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    claude: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"]
  };

  // --------------------
  // Helpers
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

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function updateModelDropdown() {
    const source = sourceSelect.value;
    let models = [];

    if (source === "Default") {
      models = defaultModels;
    } else if (source === "Local") {
      models = localBackends[localBackendSelect.value] || [];
    } else if (source === "Online") {
      models = personalProviders[providerSelect.value] || [];
    }

    populateSelect(modelSelect, models);
  }

  function updateUI() {
    const source = sourceSelect.value;

    if (source === "Default") {
      hide(providerSection);
      hide(apiKeySection);
      hide(localSection);
    }

    if (source === "Local") {
      hide(providerSection);
      hide(apiKeySection);
      show(localSection);
      populateSelect(localBackendSelect, Object.keys(localBackends));
    }

    if (source === "Online") {
      show(providerSection);
      show(apiKeySection);
      hide(localSection);
      populateSelect(providerSelect, Object.keys(personalProviders));
    }

    updateModelDropdown();
  }

  // Helper: Get text from active tab
  async function getTextFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "extractText" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (!response?.text) {
          reject(new Error("No text extracted"));
        } else {
          resolve(response);
        }
      });
    });
  }

  // --------------------
  // Load Saved Settings
  // --------------------
  chrome.storage.sync.get(["reduceStopwords"], (result) => {
    reduceStopwordsCheckbox.checked = result.reduceStopwords ?? false;
  });

  chrome.storage.sync.get(
    ["selectedProvider", "apiKey", "selectedSource", "selectedModel"],
    (result) => {
      if (result.selectedSource) sourceSelect.value = result.selectedSource;
      if (result.selectedProvider) providerSelect.value = result.selectedProvider;
      if (result.apiKey) apiKeyEl.value = result.apiKey;

      updateUI();

      if (result.selectedModel) modelSelect.value = result.selectedModel;
    }
  );

  // --------------------
  // Save Settings on Change
  // --------------------
  reduceStopwordsCheckbox.addEventListener("change", () => {
    chrome.storage.sync.set({ reduceStopwords: reduceStopwordsCheckbox.checked });
  });

  sourceSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ selectedSource: sourceSelect.value });
    updateUI();
  });

  providerSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ selectedProvider: providerSelect.value });
    updateModelDropdown();
  });

  localBackendSelect.addEventListener("change", updateModelDropdown);

  apiKeyEl.addEventListener("input", () => {
    chrome.storage.local.set({ apiKey: apiKeyEl.value });
  });

  modelSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ selectedModel: modelSelect.value });
  });

  // --------------------
  // ANALYZE Button - Independent
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
  // SUMMARIZE Button - Independent
  // --------------------
  generateBtn.addEventListener("click", async () => {
    try {
      generateBtn.disabled = true;
      generateBtn.textContent = "Summarizing...";
      summaryEl.textContent = "Processing...";

      // Extract text from current tab
      const response = await getTextFromActiveTab();
      
      // Use reduced or original text based on checkbox
      const useReduced = reduceStopwordsCheckbox.checked;
      const text = useReduced ? response.reducedText : response.text;

      // Get model settings
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

      // Send to background for summarization
      chrome.runtime.sendMessage(
        { action: "generateSummary", text, provider, apiKey, model },
        (summaryResponse) => {
          if (summaryResponse?.success) {
            summaryEl.textContent = summaryResponse.summary;
          } else {
            summaryEl.textContent = "Error: " + (summaryResponse?.error || "Unknown error");
          }
        }
      );
    } catch (err) {
      console.error("Summarize error:", err);
      summaryEl.textContent = "Error extracting text: " + err.message;
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Summarize";
    }
  });
});