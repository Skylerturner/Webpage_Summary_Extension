// content.js
// Extracts article content from web pages and PDFs

// ========================================
// Text Cleaning Utilities
// ========================================

/**
 * Normalize whitespace and line breaks in extracted text
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, " ")           // Collapse multiple spaces
    .replace(/\n\s*\n/g, "\n")      // Remove excessive line breaks
    .trim();
}

// ========================================
// Extraction Methods
// ========================================

/**
 * Extract article content from JSON-LD structured data
 * Looks for Article, NewsArticle, or BlogPosting schema types
 */
function extractFromJSONLD() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  let bestContent = "";

  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent);
      
      // Handle both single objects and arrays
      const items = Array.isArray(json["@graph"]) ? json["@graph"] :
                    Array.isArray(json) ? json : [json];

      for (const item of items) {
        const type = item["@type"];
        
        // Check if this is an article-type schema
        const isArticle = type === "Article" ||
                         type === "NewsArticle" ||
                         type === "BlogPosting" ||
                         (Array.isArray(type) && type.some(t => 
                           ["Article", "NewsArticle", "BlogPosting"].includes(t)));

        if (!isArticle) continue;

        // Extract article body
        const body = item.articleBody || item.text || item.description || "";

        // Keep the longest article body found (ignoring short snippets)
        if (body && body.length > bestContent.length) {
          bestContent = body;
        }
      }
    } catch (e) {
      // Invalid JSON, skip this script tag
      continue;
    }
  }

  // Only return if we found substantial content (not just a meta description)
  return bestContent.length > 500 ? cleanText(bestContent) : "";
}

/**
 * Extract article content from Open Graph and meta tags
 * Used as fallback when JSON-LD is not available
 */
function extractFromOpenGraph() {
  const metaSelectors = [
    'meta[property="og:article:content"]',
    'meta[property="article:content"]',
    'meta[name="twitter:text"]',
    'meta[property="og:description"]',
    'meta[name="description"]'
  ];

  let bestContent = "";

  for (const selector of metaSelectors) {
    const meta = document.querySelector(selector);
    const content = meta?.content || "";
    
    if (content.length > bestContent.length) {
      bestContent = content;
    }
  }

  // Only return if it's more than a brief description
  return bestContent.length > 200 ? cleanText(bestContent) : "";
}

/**
 * Extract article content by scraping DOM paragraphs
 * Most reliable method for full articles, with aggressive filtering
 */
function extractFromDOM(filterReferences = false) {
  const allParagraphs = [...document.querySelectorAll('p')];
  const validParagraphs = [];
  
  for (const p of allParagraphs) {
    // Skip paragraphs inside navigation, headers, footers, etc.
    if (p.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]')) {
      continue;
    }
    
    const text = p.innerText?.trim();
    if (!text || text.length < 50) continue;  // Only substantial paragraphs
    
    // Filter out common UI/junk patterns
    const junkPatterns = [
      /^(advertisement|subscribe|related|cookies|sign up|share|follow|menu|navigation|search)/i,
      /press escape|skip to|jump to/i,
      /view all|see all|read more|load more/i,
      /email updates|privacy policy|terms.*service/i,
      /instagram|facebook|twitter|x\.com/i,
      /^\s*x\s*$/i  // Single "X" (close button)
    ];
    
    // Additional filters for academic references/citations (when filtering for summary)
    if (filterReferences) {
      const referencePatterns = [
        /^(doi|pmid|issn):/i,
        /springer nature|copyright.*\d{4}|all rights reserved/i,
        /^\d{1,3},\s*\d+–\d+\s*\(\d{4}\)/,  // Citation format: "123, 456-789 (2020)"
        /^[A-Z][a-z]+,\s+[A-Z]\.\s+[A-Z]\./,  // Author format: "Smith, J. A."
        /shareable link|peer review|received.*accepted.*published/i,
        /geophys\.|sci\.|lett\.|res\./i  // Journal abbreviations
      ];
      junkPatterns.push(...referencePatterns);
    }
    
    if (junkPatterns.some(pattern => pattern.test(text))) {
      continue;
    }
    
    // Skip if mostly uppercase (likely headings/UI elements)
    const upperCaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (upperCaseRatio > 0.5) continue;
    
    // Skip if mostly repeated words (likely UI/navigation)
    const words = text.split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
      continue;
    }
    
    validParagraphs.push(text);
  }

  // Deduplicate paragraphs and join
  const uniqueParagraphs = [...new Set(validParagraphs)];
  return cleanText(uniqueParagraphs.join("\n\n"));
}

// ========================================
// Main Extraction Function
// ========================================

/**
 * Extract article text using multiple strategies
 * @param {boolean} filterReferences - Whether to filter out academic references
 * @returns {Object} Extraction result with text and source method
 */
function extractArticle(filterReferences = false) {
  // Check if this is a PDF - return URL for background script to process
  const pdfEmbed = document.querySelector('embed#plugin[type="application/x-google-chrome-pdf"]');
  if (pdfEmbed) {
    const pdfUrl = pdfEmbed.getAttribute('original-url');
    if (pdfUrl) {
      console.log("PDF detected:", pdfUrl);
      return { text: "", pdfUrl: pdfUrl, source: "PDF" };
    }
  }
  
  // Strategy 1: Try JSON-LD structured data (best for news sites)
  const jsonLD = extractFromJSONLD();
  if (jsonLD && jsonLD.length > 1000) {
    return { text: jsonLD, source: "JSON-LD" };
  }

  // Strategy 2: DOM scraping (most reliable for full articles)
  const dom = extractFromDOM(filterReferences);
  if (dom && dom.length > 500) {
    return { text: dom, source: "DOM" };
  }

  // Strategy 3: Open Graph / meta tags (fallback)
  const og = extractFromOpenGraph();
  if (og) {
    return { text: og, source: "OpenGraph" };
  }
  
  // Last resort: return whatever we got, even if short
  if (jsonLD) return { text: jsonLD, source: "JSON-LD (short)" };
  if (dom) return { text: dom, source: "DOM (short)" };
  
  return { text: "", source: "None" };
}

// ========================================
// Message Listener
// ========================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "extractText") {
    // Extract full text (no filtering - for NLP analysis)
    const fullExtraction = extractArticle(false);
    
    // If it's a PDF, return the URL for background script to process
    if (fullExtraction.pdfUrl) {
      sendResponse({
        pdfUrl: fullExtraction.pdfUrl,
        source: "PDF"
      });
      return;
    }
    
    // Extract filtered text (remove references - for summarization)
    const filteredExtraction = extractArticle(true);

    sendResponse({ 
      text: fullExtraction.text,              // Full text for NLP analysis
      textForSummary: filteredExtraction.text, // Filtered text for summarization
      source: fullExtraction.source
    });
  }
});