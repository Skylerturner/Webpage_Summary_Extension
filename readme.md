# Smart Article Summarizer

A browser extension that intelligently extracts and summarizes web articles and PDF files using local AI—completely private, no API keys required.

## Features

- **Local AI Summarization** – Uses DistilBART running entirely in your browser via transformers.js.
- **Complete Privacy** – All processing happens locally; no user data is sent to external servers.
- **NLP Analysis** – Displays word count, reading time, top keywords, sentiment, and subjectivity scores.
- **Multi-Format Support** – Works with web articles, blogs, news sites, and PDFs.
- **Advanced PDF Processing** – Seamlessly extracts and summarizes academic papers, research documents, and technical reports with intelligent text parsing.
- **Smart Chunking** – Handles long documents by splitting them into manageable parts.
- **Clean Extraction** – Filters out navigation, ads, and other non-content elements.

## Installation

### For Development / Testing

1. Clone this repository
   ```bash
   git clone https://github.com/Skylerturner/Webpage_Summary_Extension.git
   ```

2. Ensure PDF.js is included (for PDF support)
   - `pdf-lib/` should contain `pdf.mjs` and `pdf.worker.mjs` (already in this repo).

3. Load the extension in Chrome / Edge
   - Navigate to `chrome://extensions/` or `edge://extensions/`.
   - Enable "Developer mode".
   - Click "Load unpacked" and select the extension folder.

### For Chrome Web Store (Coming Soon)

The extension will eventually be available for easy installation from the Chrome Web Store.

## Usage

1. Open an article or PDF in your browser.
2. Click the extension icon in the toolbar.
3. **Analyze the article** (optional)
   - Click "Analyze" to view:
     - Word count
     - Estimated reading time
     - Top 5 keywords
     - Sentiment score
     - Subjectivity score
4. **Generate a summary**
   - Click "Summarize" to generate an AI-driven summary.
   - Long articles are automatically chunked and processed.
   - A progress bar displays real-time status.

### PDF Summarization

Perfect for academic research and technical documentation:

- **Research Papers** – Quickly extract key findings from academic publications
- **Technical Reports** – Distill complex technical documents into digestible summaries
- **Long-Form Documents** – Handle multi-page PDFs with automatic chunking
- **Preserved Structure** – Maintains context across sections for coherent summaries

Simply open any PDF in your browser and click "Summarize" to get started.

## How It Works

### Text Extraction

- Extracts article content via DOM scraping, JSON-LD, or Open Graph/meta tags.
- **Advanced PDF Text Extraction** – Leverages PDF.js to parse and extract text from complex PDF documents, including academic papers with multi-column layouts.
- Filters out ads, navigation, and other non-essential elements.
- Supports both web pages and PDF documents with equal precision.

### AI Summarization

- Uses DistilBART-CNN-6-6 locally through transformers.js.
- Runs entirely in the browser using WebAssembly/WebGPU.
- Long articles are chunked, summarized iteratively, and combined into a concise summary.

### NLP Analysis

- Word frequency analysis for keywords (ignores stopwords)
- Sentiment analysis via positive/negative word lists
- Subjectivity detection using opinion-indicating language patterns

## Technical Details

### Architecture

- **Manifest V3** – Modern Chrome extension standard
- **Service Worker** – Handles background tasks and messaging
- **Offscreen Document** – Runs AI models in an isolated environment
- **Content Script** – Injected for extracting page text

### File Structure

```
smart-article-summarizer/
├── manifest.json
├── background.js
├── content.js
├── offscreen.html
├── offscreen.js
├── config.js
├── Afinn.csv
├── nlp-dict.js
├── popup_files/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── pdf-lib/
│   ├── pdf.mjs
│   └── pdf.worker.mjs
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── transformers/
    ├── transformers.js
    ├── ort-wasm-simd-threaded.jsep
    └── ort-wasm-simd-threaded.jsep.wasm
```

### Permissions Explained

- **storage** – Save user preferences.
- **tabs / activeTab** – Access the current tab content.
- **scripting** – Inject content scripts for text extraction.
- **offscreen** – Run AI models in a separate, hidden document.
- **host permissions** – `https://huggingface.co/*` for first-time model download.

## Browser Compatibility

- Chrome 116+ (Manifest V3, offscreen support)
- Edge 116+ (Chromium-based)
- Firefox and Safari may require adjustments (different extension APIs)

## Performance

- **First use:** 2–5 seconds for model download (~25MB)
- **Subsequent uses:** near-instant
- **Short articles** (<2000 words): 2–5 seconds
- **Long articles** (5000+ words): 30–60 seconds
- **Memory usage:** ~200–400MB during processing

## Privacy

- Fully local processing; no user data leaves your browser.
- No tracking, analytics, or API keys required.
- Internet needed only for the initial model download.

## Limitations

- Performance depends on device capabilities.
- Very long documents (10,000+ words) may take 1–2 minutes.
- Complex site layouts may not extract perfectly.
- Scanned PDFs (non-searchable text) are not supported. PDFs must contain selectable text for summarization.

## Troubleshooting

### "No text extracted" error

- Page may lack article content.
- Try another page or check browser console (F12).

### Summarization is slow

- Normal for long articles.
- First-time use requires model download.
- Close other tabs to free up memory.

### Extension won't load

- Ensure Chrome/Edge 116+.
- Verify all files are in the correct locations.
- Check `chrome://extensions/` developer console for errors.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

## License

MIT License – see LICENSE file.

## Credits

- **DistilBART Model** – Hugging Face
- **Transformers.js** – Xenova
- **NLP Dictionaries** – Derived from NLTK and custom word lists

## Support

- Report bugs via [GitHub Issues](https://github.com/Skylerturner/Webpage_Summary_Extension/issues)
- Discussion via [GitHub Discussions](https://github.com/Skylerturner/Webpage_Summary_Extension/discussions)

---

This project gave me hands-on experience with JavaScript and HTML. I built this for privacy-conscious readers who want fast, local AI summarization directly in their browser, whether they're researching academic papers, analyzing technical documentation, or simply catching up on the news.