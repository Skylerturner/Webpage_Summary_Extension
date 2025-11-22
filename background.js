// background.js
// Handles LLM API calls and messages from popup.js

// --------------------
// Helper: fetch summary from Hugging Face
async function summarizeHuggingFace(text, apiKey, model="facebook/bart-large-cnn") {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: text })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data[0]?.summary_text || "";
}

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
// Optional: local transformer.js (Ollama or browser model)
async function summarizeLocal(text) {
    // Example placeholder, depends on how transformer.js or Ollama is integrated
    // Return text unchanged for now
    return text;
}

// --------------------
// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "generateSummary") {
        const { text, provider, apiKey } = message;

        let summaryPromise;

        switch(provider) {
            case "huggingface":
                summaryPromise = summarizeHuggingFace(text, apiKey);
                break;
            case "openai":
                summaryPromise = summarizeOpenAI(text, apiKey);
                break;
            case "claude":
                summaryPromise = summarizeClaude(text, apiKey);
                break;
            case "local":
                summaryPromise = summarizeLocal(text);
                break;
            default:
                summaryPromise = Promise.reject("Unknown provider");
        }

        summaryPromise
            .then(summary => sendResponse({ success: true, summary }))
            .catch(err => sendResponse({ success: false, error: err.message || err }));

        // Keep the message channel open for async response
        return true;
    }
});
