// content.js
// Extracts article content when popup requests it



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
    let article = document.querySelector("article");
    if (article) return article.innerText;

    let paragraphs = Array.from(document.querySelectorAll("p"));
    let largestText = paragraphs
        .map(p => p.innerText)
        .sort((a, b) => b.length - a.length)[0] || "";

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

// --------------------
// Preprocessing for LLM
// --------------------
function prepareForLLM(text) {
    const cleanText = removeStopwords(text);
    return cleanText;
}

// --------------------
// LISTEN for popup requests
// --------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.action === "extractText") {
        const { text, source } = extractArticle();

        chrome.storage.local.set({ 
            article: { originalText: text }, 
            source 
        });

        sendResponse({ text });
    }

    // required so Chrome knows we may reply async
    return true;
});
