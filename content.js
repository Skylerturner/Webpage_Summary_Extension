// content.js
// Extracts article content when popup requests it

// --------------------
// Helper Functions
// --------------------

// Remove stopwords
function removeStopwords(text) {
    const stopwordSet = new Set([
        "the","a","an","and","or","of","in","on","for","with","to","by",
        "is","are","was","were","be","been","being",
        "this","that","these","those",
        "it","its","as","at","from","so"
    ]);

    // Critical stopwords to keep because they affect meaning
    const critical = new Set(["not","but","however","yet","although","because"]);

    return text
        .split(/\b/)
        .map(token => {
            const word = token.toLowerCase();
            if (critical.has(word)) return token;
            if (stopwordSet.has(word)) return "";
            return token;
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim();
}


// Normalize text spacing
function cleanText(text) {
    return text
        .replace(/\s+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .trim();
}

// Extract text from JSON-LD <script type="application/ld+json">
function extractJSONLD() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (let script of scripts) {
        try {
            const json = JSON.parse(script.textContent);

            // JSON-LD may contain an array of items
            const items = Array.isArray(json) ? json : [json];

            for (let item of items) {
                let type = item["@type"];

                // Handle array-type entries
                if (Array.isArray(type)) {
                    if (!type.includes("Article") &&
                        !type.includes("NewsArticle") &&
                        !type.includes("BlogPosting")) continue;
                } else if (!["Article", "NewsArticle", "BlogPosting"].includes(type)) {
                    continue;
                }

                const text =
                    item.articleBody ||
                    item.text ||
                    item.description ||
                    "";

                if (text && text.length > 50) return cleanText(text);
            }
        } catch (e) {
            continue;
        }
    }
    return "";
}

// Extract meta descriptions / Open Graph
function extractOpenGraph() {
    const candidates = [
        'meta[property="og:description"]',
        'meta[name="description"]',
        'meta[property="twitter:description"]'
    ];

    for (let selector of candidates) {
        const value = document.querySelector(selector)?.content;
        if (value && value.length > 40) return cleanText(value);
    }

    return "";
}

// DOM scraping fallback
function extractFromDOM() {
    let article = document.querySelector("article");

    if (article) {
        return cleanText(article.innerText);
    }

    const paragraphs = Array.from(document.querySelectorAll("p"))
        .map(p => p.innerText)
        .filter(t => t.trim().length > 40);

    if (paragraphs.length > 0) {
        return cleanText(paragraphs.join("\n\n"));
    }

    return "";
}

// --------------------
// Main Extraction Function
// --------------------
function extractArticle() {
    let text = extractJSONLD();
    let source = "JSON-LD";

    if (!text) {
        text = extractOpenGraph();
        source = "OpenGraph / Meta";
    }

    if (!text) {
        text = extractFromDOM();
        source = "DOM Fallback";
    }

    return { text, source };
}

// --------------------
// LISTEN for popup requests
// --------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "extractText") {
        const { text, source } = extractArticle();

        const cleanForLLM = removeStopwords(text);

        chrome.storage.local.set({
            article: {
                originalText: text,
                reducedText: cleanForLLM    // <—— add this
            },
            source
        });

        sendResponse({ text });
    }
});

