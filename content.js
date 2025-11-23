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
    let best = "";

    for (let script of scripts) {
        try {
            const json = JSON.parse(script.textContent);
            const items = Array.isArray(json["@graph"]) ? json["@graph"] :
                          Array.isArray(json) ? json : [json];

            for (let item of items) {
                const type = item["@type"];
                const validType =
                    type === "Article" ||
                    type === "NewsArticle" ||
                    type === "BlogPosting" ||
                    (Array.isArray(type) && type.some(t =>
                        ["Article","NewsArticle","BlogPosting"].includes(t)));

                if (!validType) continue;

                const body =
                    item.articleBody ||
                    item.text ||
                    item.description ||
                    "";

                // Ignore short intros
                if (body && body.length > best.length) {
                    best = body;
                }
            }
        } catch (_) {}
    }

    return best.length > 500 ? cleanText(best) : "";
}

// Extract meta descriptions / Open Graph
function extractOpenGraph() {
    const candidates = [
        'meta[property="og:article:content"]',
        'meta[property="article:content"]',
        'meta[name="twitter:text"]',
        'meta[property="og:description"]',
        'meta[name="description"]'
    ];

    let best = "";

    for (const selector of candidates) {
        const value = document.querySelector(selector)?.content;
        if (value && value.length > best.length) best = value;
    }

    return best.length > 200 ? cleanText(best) : "";
}

// DOM scraping fallback
function extractFromDOM() {
    const selectors = [
        "article p", "article div",
        "main p", "main div",
        "section p", "section div",
        "p", "div"
    ];

    const nodes = [...document.querySelectorAll(selectors.join(","))];

    const chunks = [];

    for (const n of nodes) {
        const t = n.innerText?.trim();
        if (!t) continue;
        if (t.length < 25) continue;  // skip tiny crumbs
        if (/^(advertisement|subscribe|related|cookies)/i.test(t)) continue;
        chunks.push(t);
    }

    // Deduplicate and join
    const text = [...new Set(chunks)].join("\n\n");

    return cleanText(text);
}

// --------------------
// Main Extraction Function
// --------------------
function extractArticle() {
    let json = extractJSONLD();
    if (json) return { text: json, source: "JSON-LD" };

    let og = extractOpenGraph();
    if (og) return { text: og, source: "OpenGraph" };

    const dom = extractFromDOM();
    return { text: dom, source: "DOM" };
}

// --------------------
// LISTEN for popup requests
// --------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "extractText") {
        const { text, source } = extractArticle();
        
        // Return both original and reduced text
        const reducedText = removeStopwords(text);

        sendResponse({ 
            text: text,              // Original text
            reducedText: reducedText, // Stopwords removed
            source: source            // Where it came from
        });
    }
});

