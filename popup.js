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
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
    claude: ["claude-3-sonnet", "claude-3-haiku"]
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

  // --------------------
  // Reduce Stopwords Checkbox
  // --------------------
  const reduceStopwordsCheckbox = document.getElementById("reduceStopwords");

  // Load saved state
  chrome.storage.sync.get(["reduceStopwords"], (result) => {
    reduceStopwordsCheckbox.checked = result.reduceStopwords ?? false;
  });

  // Save on change
  reduceStopwordsCheckbox.addEventListener("change", () => {
    chrome.storage.sync.set({ reduceStopwords: reduceStopwordsCheckbox.checked });
  });

  // --------------------
  // Initial Load
  // --------------------
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

  // Save settings
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
  // NLP Analysis Button
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

      chrome.runtime.sendMessage(
        { action: "computeNLP", text: response.text },
        (nlp) => {
          if (!nlp) return;

          wordCountEl.textContent = nlp.wordCount;
          readingTimeEl.textContent = nlp.readingTime;
          topKeywordsEl.textContent = nlp.topKeywords;
          sentimentScoreEl.textContent = nlp.sentimentScore;
          subjectivityScoreEl.textContent = nlp.subjectivityScore;

          chrome.storage.local.set({ nlp });
        }
      );
    });
  });

  // --------------------
  // Summary Generation
  // --------------------
  generateBtn.addEventListener("click", () => {
    chrome.storage.local.get(["article"], (data) => {
      if (!data.article?.originalText) {
        summaryEl.textContent = "No article text available.";
        return;
      }

      const useReduced = reduceStopwordsCheckbox.checked;

      const text = useReduced
        ? data.article.reducedText || data.article.originalText
        : data.article.originalText;

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

      chrome.runtime.sendMessage(
        { action: "generateSummary", text, provider, apiKey, model },
        (response) => {
          if (response?.success) {
            summaryEl.textContent = response.summary;
          } else {
            summaryEl.textContent = "Error generating summary: " + (response?.error || "Unknown");
          }
        }
      );
    });
  });
});