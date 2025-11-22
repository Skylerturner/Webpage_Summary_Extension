// transformer.js
// Local transformer summarization (browser-side, uses transformers.js library)

// Summarize text with a selected transformer model
async function summarizeWithTransformerJS(text, model = "distilbart-cnn-12-6") {
    if (!window.transformers) {
        console.error("Transformers.js not loaded!");
        return text; // fallback
    }

    try {
        // Initialize summarization pipeline
        const summarizer = await window.transformers.pipeline("summarization", model);

        // Summarize text
        const summaryArr = await summarizer(text, {
            max_length: 150,
            min_length: 40,
            do_sample: false
        });

        return summaryArr[0].summary_text || text;
    } catch (err) {
        console.error("Transformers.js summarization failed:", err);
        return text;
    }
}

// Export for background.js usage
window.summarizeWithTransformerJS = summarizeWithTransformerJS;

