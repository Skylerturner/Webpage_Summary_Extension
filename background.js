// background.js
// Handles LLM API calls and messages from popup.js

// --------------------
// Helper: fetch summary from OpenAI
async function summarizeOpenAI(text, apiKey, model="gpt-4o-mini") {
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
          { role: "system", content: "You are a helpful summarizer." },
          { role: "user", content: text }
        ]
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("OpenAI summarization error:", err);
    throw err;
  }
}

// --------------------
// Helper: fetch summary from Claude
async function summarizeClaude(text, apiKey, model="claude-v1") {
  try {
    const response = await fetch("https://api.anthropic.com/v1/complete", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: `Please summarize the following article:\n\n${text}`,
        max_tokens_to_sample: 500
      })
    });
    const data = await response.json();
    return data.completion || "";
  } catch (err) {
    console.error("Claude summarization error:", err);
    throw err;
  }
}

// --------------------
// Local summarization: transformers.js or Ollama
async function summarizeLocal(text, backend="transformers.js") {
  if (backend === "transformers.js") {
    if (!window.transformers) return text;
    try {
      const summarizer = await window.transformers.pipeline("summarization", "distilbart-cnn-12-6");
      const summaryArr = await summarizer(text, { max_length: 150, min_length: 40, do_sample: false });
      return summaryArr[0].summary_text || text;
    } catch (err) {
      console.error("Transformers.js summarization failed:", err);
      return text;
    }
  } else if (backend === "Ollama") {
    // placeholder for Ollama local API integration
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
  const readingTime = Math.ceil(wordCount / 200);

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
      case "transformers.js":
        summaryPromise = summarizeLocal(text, "transformers.js");
        break;
      case "Ollama":
        summaryPromise = summarizeLocal(text, "Ollama");
        break;
      case "openai":
        summaryPromise = summarizeOpenAI(text, apiKey, model);
        break;
      case "claude":
        summaryPromise = summarizeClaude(text, apiKey, model);
        break;
      default:
        summaryPromise = Promise.reject("Unknown provider: " + provider);
    }

    summaryPromise
      .then(summary => sendResponse({ success: true, summary }))
      .catch(err => sendResponse({ success: false, error: err.message || err }));

    return true; // keep channel open
  }

  if (action === "computeNLP") {
    const nlp = computeNLP(text);
    sendResponse(nlp);
    return true;
  }
});
