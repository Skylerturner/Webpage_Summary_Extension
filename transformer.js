// transformer.js
// Local transformer summarization (browser-side, uses transformers.js library)

// Note: transformers.js is designed to run small models in-browser (CPU/GPU).
// You can use a dist file from their CDN or npm package.

// --------------------
// START NOTES FOR LATER!!!!!
// --------------------
// This requires transformers.js to be included in your extension or loaded from a CDN:
// <script src="https://cdn.jsdelivr.net/npm/@xenova/transformers/dist/transformers.min.js"></script>


// Models like distilbart-cnn-12-6 are small enough to run in-browser, but large models may be slow on low-end machines.
// Can optionally integrate GPU acceleration if WebGL/WebGPU is available.
// --------------------
// END NOTES FOR LATER!!!!!
// --------------------

async function summarizeWithTransformerJS(text) {
    if (!window.transformers) {
        console.error("Transformers.js not loaded!");
        return text; // fallback: return original text
    }

    try {
        // Initialize a summarization pipeline (example using distilbart-cnn-12-6)
        const summarizer = await window.transformers.pipeline("summarization", "distilbart-cnn-12-6");

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

// Example: allow background.js to call this if provider === "local"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "generateSummary" && message.provider === "local") {
        summarizeWithTransformerJS(message.text)
            .then(summary => sendResponse({ success: true, summary }))
            .catch(err => sendResponse({ success: false, error: err.message || err }));

        return true; // Keep message channel open for async response
    }
});
