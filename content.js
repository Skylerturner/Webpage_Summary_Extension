// content.js
// Runs on every page and extracts article content


// --------------------
// Toggle extension
// --------------------
chrome.storage.sync.get(["enableExtraction"], (result) => {
    const enabled = result.enableExtraction ?? true;

    if (!enabled) {
        console.log("Smart Summarizer: Extraction disabled by user.");
        return;
    }

    runExtraction();
});

// --------------------
// Helper Functions
// --------------------

// Remove stopwords from a string
const stopwords = ["the","a","an","and","or","of","in","on","for","with","to","by"];
function removeStopwords(text) {
    return text
        .split(" ")
        .filter(word => !stopwords.includes(word.toLowerCase()))
        .join(" ");
}

// Extract text from JSON-LD <script type="application/ld+json">
function extractJSONLD() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (let script of scripts) {
        try {
            const json = JSON.parse(script.textContent);
            // Handle common article types
            if (json["@type"] === "Article" || json["@type"] === "NewsArticle" || json["@type"] === "BlogPosting") {
                return json.articleBody || json.text || json.description || "";
            }
        } catch (e) {
            continue;
        }
    }
    return "";
}

// Extract text from Open Graph metadata
function extractOpenGraph() {
    const ogDescription = document.querySelector('meta[property="og:description"]')?.content;
    return ogDescription || "";
}

// DOM scraping fallback
function extractFromDOM() {
    // Try <article> first
    let article = document.querySelector("article");
    if (article) return article.innerText;

    // If no <article>, pick the largest text block
    let paragraphs = Array.from(document.querySelectorAll("p"));
    let largestText = paragraphs.map(p => p.innerText).sort((a,b) => b.length - a.length)[0] || "";
    return largestText;
}

// --------------------
// Main Extraction Function
// --------------------
function extractArticle() {
    let text = extractJSONLD();
    let source = "JSON-LD";

    if (!text) {
        text = extractOpenGraph();
        source = "Open Graph";
    }

    if (!text) {
        text = extractFromDOM();
        source = "DOM";
    }

    return { text, source };
}

// FIGURE A WAY OUT TO INTEGRATE THIS
function runExtraction() {
    const { text, source } = extractArticle();
    const processed = preprocessArticle(text);

    chrome.storage.local.set({
        article: processed,
        source
    });

    console.log("Article extracted from:", source);
}


// --------------------
// Basic NLP Insights
// --------------------
function analyzeText(text) {
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    const wordCount = words.length;
    const readingTime = Math.ceil(wordCount / 200); // 200 WPM
    const tokenEstimate = Math.ceil(charCount / 4); // rough GPT-style estimate

    // Most frequent word (excluding stopwords)
    const wordFreq = {};
    words.forEach(w => {
        const lw = w.toLowerCase();
        if (!stopwords.includes(lw)) {
            wordFreq[lw] = (wordFreq[lw] || 0) + 1;
        }
    });
    const mostUsedWord = Object.keys(wordFreq).sort((a,b) => wordFreq[b]-wordFreq[a])[0] || "";

    return {
        wordCount,
        readingTime,
        tokenEstimate,
        mostUsedWord
    };
}

// --------------------
// Preprocessing for LLM (only when user requests summary)
function prepareForLLM(text) {
    const cleanText = removeStopwords(text);
    return cleanText;
}

// --------------------
// Run basic NLP on page load
(function () {
    const { text, source } = extractArticle();
    const insights = analyzeText(text);

    chrome.storage.local.set({
        article: {
            originalText: text,
            insights
        },
        source
    });

    console.log("Article extracted from:", source);
    console.log("Basic NLP insights:", insights);
})();
