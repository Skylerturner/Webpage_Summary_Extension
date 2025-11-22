// background.js
// Handles LLM API calls and messages from popup.js

// --------------------
// Helper: fetch summary from OpenAI
async function summarizeOpenAI(text, apiKey, model="gpt-4o-mini") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: "You are a helpful summarizer." },
                { role: "user", content: text }
            ]
        })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

// --------------------
// Helper: fetch summary from Claude
async function summarizeClaude(text, apiKey) {
    const response = await fetch("https://api.anthropic.com/v1/complete", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "claude-v1",
            prompt: `Please summarize the following article:\n\n${text}`,
            max_tokens_to_sample: 500
        })
    });
    const data = await response.json();
    return data.completion || "";
}

// --------------------
// Local summarization: transformers.js (default) or Ollama
async function summarizeLocal(text, backend = "transformers.js") {
    if (backend === "transformers.js") {
        if (!window.transformers) return text; // fallback
        try {
            const summarizer = await window.transformers.pipeline("summarization", "distilbart-cnn-12-6");
            const summaryArr = await summarizer(text, { max_length: 150, min_length: 40, do_sample: false });
            return summaryArr[0].summary_text || text;
        } catch (err) {
            console.error("Transformers.js summarization failed:", err);
            return text;
        }
    } else if (backend === "ollama") {
        // placeholder for Ollama local API integration
        // return await fetch("http://localhost:11434/summarize", {...})
        return text;
    }
    return text;
}

// --------------------
// Compute basic NLP metrics
function computeNLP(text) {
    const stopwords = ["the","a","an","and","or","of","in","on","for","with","to","by"];
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    const wordCount = words.length;
    const readingTime = Math.ceil(wordCount / 200); // 200 WPM

    const freq = {};
    words.forEach(w => {
        const lw = w.toLowerCase();
        if (!stopwords.includes(lw)) freq[lw] = (freq[lw] || 0) + 1;
    });
    const topKeywords = Object.entries(freq)
        .sort((a,b) => b[1]-a[1])
        .slice(0,5)
        .map(x => x[0])
        .join(", ");

    const positiveWords = ["good","great","excellent","positive","happy","success","benefit","improve"];
    const negativeWords = ["bad","poor","negative","fail","problem","worse","decline","issue"];
    const subjectiveWords = ["I","we","my","our","believe","think","feel","opinion"];

    let sentimentScore = 0;
    let subjectivityScore = 0;

    words.forEach(w => {
        const lw = w.toLowerCase();
        if (positiveWords.includes(lw)) sentimentScore += 1;
        if (negativeWords.includes(lw)) sentimentScore -= 1;
        if (subjectiveWords.includes(w)) subjectivityScore += 1;
    });

    subjectivityScore = +(subjectivityScore / wordCount).toFixed(2);

    return { wordCount, readingTime, topKeywords, sentimentScore, subjectivityScore };
}

// --------------------
// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, provider, model, apiKey, text } = message;

  if (action === "generateSummary") {
    let summaryPromise;

    switch (provider) {
      case "default":
        // Use bundled transformers.js
        summaryPromise = summarizeWithTransformerJS(text, model);
        break;

      case "local":
        // Ollama call
        summaryPromise = summarizeWithOllama(text, model);
        break;

      case "openai":
        summaryPromise = summarizeOpenAI(text, apiKey, model);
        break;

      case "claude":
        summaryPromise = summarizeClaude(text, apiKey, model);
        break;

      default:
        summaryPromise = Promise.reject("Unknown provider");
    }

    summaryPromise
      .then(summary => sendResponse({ success: true, summary }))
      .catch(err => sendResponse({ success: false, error: err.message || err }));

    return true; // keep channel open
  }
});
