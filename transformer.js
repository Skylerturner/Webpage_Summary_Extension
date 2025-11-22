// transformer.js
// Local transformer summarization (browser-side, uses transformers.js library)

// transformer.js
async function summarizeWithTransformerJS(text, model = "distilbart-cnn-12-6") {
    if (!window.transformers) {
        console.error("Transformers.js not loaded!");
        return text; // fallback: return original text
    }

    try {
        // Initialize a summarization pipeline with the selected model
        const summarizer = await window.transformers.pipeline("summarization", model);

        const summaryArr = await summarizer(text, {
            max_length: 150,
            min_length: 40,
            do_sample: false
        });

        return summaryArr[0].summary_text || text;
    } catch (err) {
        console.error("Transformer.js summarization failed:", err);
        return text;
    }
}

// Message listener for background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "generateSummary" && message.provider === "local") {
        // Pass the user-selected model
        summarizeWithTransformerJS(message.text, message.model)
            .then(summary => sendResponse({ success: true, summary }))
            .catch(err => sendResponse({ success: false, error: err.message || err }));

        return true; // Keep the message channel open for async response
    }
});
