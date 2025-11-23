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
function extractFromDOM(filterReferences = false) {
    // Get ALL paragraph tags from the entire page
    const allParagraphs = [...document.querySelectorAll('p')];
    
    const chunks = [];
    
    for (const p of allParagraphs) {
        // Skip if paragraph is inside unwanted elements
        const parent = p.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]');
        if (parent) continue;
        
        const t = p.innerText?.trim();
        if (!t || t.length < 50) continue;  // Only substantial paragraphs
        
        // Filter out common junk patterns
        const junkPatterns = [
            /^(advertisement|subscribe|related|cookies|sign up|share|follow|menu|navigation|search|footer|header)/i,
            /press escape/i,
            /follow us/i,
            /instagram|facebook|twitter|x\.com/i,
            /default settings/i,
            /close.*window/i,
            /cancel.*close/i,
            /skip to/i,
            /jump to/i,
            /view all|see all|read more|load more/i,
            /^\s*x\s*$/i,
            /email updates/i,
            /privacy policy/i,
            /terms.*service/i
        ];
        
        // Additional filters for summarization only (not NLP)
        if (filterReferences) {
            const referencePatterns = [
                /^(doi|pmid|issn):/i,
                /springer nature/i,
                /copyright.*\d{4}/i,
                /all rights reserved/i,
                /^\d{1,3},\s*\d+–\d+\s*\(\d{4}\)/,  // "123, 456-789 (2020)" citation format
                /^[A-Z][a-z]+,\s+[A-Z]\.\s+[A-Z]\./,  // "Smith, J. A." author format
                /shareable link/i,
                /peer review/i,
                /received.*accepted.*published/i,
                /geophys\.|sci\.|lett\.|res\./i  // Journal abbreviations
            ];
            junkPatterns.push(...referencePatterns);
        }
        
        if (junkPatterns.some(pattern => pattern.test(t))) continue;
        
        // Skip if mostly uppercase (likely headings/UI)
        const upperCaseRatio = (t.match(/[A-Z]/g) || []).length / t.length;
        if (upperCaseRatio > 0.5) continue;
        
        // Skip if it's mostly repeated words
        const words = t.split(/\s+/);
        const uniqueWords = new Set(words);
        if (words.length > 10 && uniqueWords.size / words.length < 0.3) continue;
        
        chunks.push(t);
    }

    // Deduplicate and join
    const text = [...new Set(chunks)].join("\n\n");

    return cleanText(text);
}

// --------------------
// PDF Text Extraction
// --------------------
function extractPDFText() {
    try {
        // Method 1: Try to get text from Chrome's PDF viewer embed
        const embed = document.querySelector('embed[type="application/pdf"]');
        if (embed) {
            // Chrome's PDF viewer doesn't expose text directly via DOM
            // We need to use selection API
            
            // Select all text in the document
            const selection = window.getSelection();
            selection.selectAllChildren(document.body);
            const text = selection.toString();
            selection.removeAllRanges();
            
            if (text && text.length > 100) {
                console.log("Extracted PDF text via selection");
                return cleanText(text);
            }
        }
        
        // Method 2: Try iframe approach (some PDFs load this way)
        const iframe = document.querySelector('iframe');
        if (iframe) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const iframeText = iframeDoc.body.innerText;
                if (iframeText && iframeText.length > 100) {
                    console.log("Extracted PDF text from iframe");
                    return cleanText(iframeText);
                }
            } catch (e) {
                // Cross-origin iframe, can't access
                console.log("Cannot access iframe (cross-origin)");
            }
        }
        
        // Method 3: Fallback - try to get any text from the page
        const bodyText = document.body.innerText;
        if (bodyText && bodyText.length > 100) {
            console.log("Extracted PDF text from body");
            return cleanText(bodyText);
        }
        
        console.log("Could not extract text from PDF");
        return "";
        
    } catch (err) {
        console.error("PDF extraction error:", err);
        return "";
    }
}

// --------------------
// Main Extraction Function
// --------------------
function extractArticle(filterReferences = false) {
    // Check if this is a PDF
    if (document.contentType === 'application/pdf' || window.location.href.toLowerCase().endsWith('.pdf')) {
        const pdfText = extractPDFText();
        if (pdfText) return { text: pdfText, source: "PDF" };
    }
    
    // Try JSON-LD first, but only if it has substantial content
    let json = extractJSONLD();
    if (json && json.length > 1000) return { text: json, source: "JSON-LD" };

    // Try DOM extraction (most reliable for full articles)
    const dom = extractFromDOM(filterReferences);
    if (dom && dom.length > 500) return { text: dom, source: "DOM" };

    // Fallback to OpenGraph if DOM didn't work
    let og = extractOpenGraph();
    if (og) return { text: og, source: "OpenGraph" };
    
    // Last resort: return whatever we got, even if short
    if (json) return { text: json, source: "JSON-LD (short)" };
    if (dom) return { text: dom, source: "DOM (short)" };
    
    return { text: "", source: "None" };
}

// --------------------
// LISTEN for popup requests
// --------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "extractText") {
        // Extract full text (for NLP analysis)
        const fullExtraction = extractArticle(false);  // Don't filter references
        
        // Extract filtered text (for summarization)
        const filteredExtraction = extractArticle(true);  // Filter references
        
        // Apply stopword removal if needed
        const reducedFull = removeStopwords(fullExtraction.text);
        const reducedFiltered = removeStopwords(filteredExtraction.text);

        sendResponse({ 
            text: fullExtraction.text,              // Full text for NLP
            textForSummary: filteredExtraction.text,  // Filtered text for summarization
            reducedText: reducedFull,                 // Stopwords removed (full)
            reducedTextForSummary: reducedFiltered,   // Stopwords removed (filtered)
            source: fullExtraction.source
        });
    }
});