# Smart Article Summarizer

A Chrome browser extension that intelligently extracts and summarizes web articles using local AI - completely private, with no API keys required.

## Features

- 🤖 **Local AI Summarization** - Uses DistilBART running entirely in your browser via transformers.js
- 🔒 **Complete Privacy** - No data sent to external servers, no API keys needed
- 📊 **NLP Analysis** - Get word count, reading time, top keywords, sentiment, and subjectivity scores
- 📄 **Multi-Format Support** - Works with web articles, blog posts, news sites, and PDFs
- ⚡ **Smart Chunking** - Handles long documents by intelligently breaking them into parts
- 🎯 **Clean Extraction** - Filters out navigation, ads, and other non-content elements

## Installation

### For Development/Testing

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/yourusername/smart-article-summarizer.git
   ```

2. **Install PDF.js library** (for PDF support)
   - Download PDF.js from [Mozilla's PDF.js releases](https://github.com/mozilla/pdf.js/releases)
   - Extract `pdf.mjs` and `pdf.worker.mjs` 
   - Place them in a `pdf-lib/` folder in the extension directory

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the extension directory

### For Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once published.

## Usage

1. **Navigate to any article** - Open a web page with article content (news sites, blog posts, Wikipedia, etc.)

2. **Click the extension icon** in your browser toolbar

3. **Analyze the article** (optional)
   - Click "Analyze" to see:
     - Word count
     - Estimated reading time
     - Top 5 keywords
     - Sentiment score (positive/negative/neutral)
     - Subjectivity score (objective/subjective)

4. **Generate a summary**
   - Click "Summarize" to create an AI-generated summary
   - For long articles, the extension will automatically chunk and process them
   - Progress bar shows real-time status

## How It Works

### Text Extraction

The extension uses multiple strategies to extract article content:

1. **JSON-LD structured data** - Best for news sites and blogs with proper schema markup
2. **DOM scraping** - Intelligently extracts paragraph content while filtering navigation, ads, and UI elements
3. **Open Graph / meta tags** - Fallback for sites without structured content

### AI Summarization

- Uses **DistilBART-CNN-6-6** - A lightweight, efficient summarization model
- Runs entirely locally using **transformers.js** and WebAssembly/WebGPU
- For long documents:
  - Splits into manageable chunks
  - Summarizes each chunk individually
  - Iteratively combines summaries (reducing by 1/5 each round) until a final summary is created

### NLP Analysis

Basic natural language processing includes:
- **Word frequency analysis** for keyword extraction (excluding stopwords)
- **Sentiment analysis** using positive/negative word dictionaries
- **Subjectivity detection** based on opinion-indicating language patterns

## Technical Details

### Architecture

- **Manifest V3** - Uses the latest Chrome extension standard
- **Service Worker** - Background script for coordination
- **Offscreen Document** - Isolated environment for running AI models
- **Content Script** - Injected into web pages for text extraction

### Technologies

- **Transformers.js** - Run Hugging Face models in the browser
- **WebGPU/WebAssembly** - Hardware acceleration for AI inference
- **PDF.js** - PDF text extraction (Mozilla's library)

### File Structure

```
smart-article-summarizer/
├── manifest.json           # Extension configuration
├── popup.html             # UI markup
├── popup.css              # UI styling
├── popup.js               # UI logic
├── background.js          # Service worker
├── content.js             # Web page text extraction
├── offscreen.html         # Offscreen document container
├── offscreen.js           # AI model runner
├── pdf-helper.js          # PDF text extraction
├── nlp-dict.js            # Word dictionaries for NLP
├── pdf-lib/               # PDF.js library files
│   ├── pdf.mjs
│   └── pdf.worker.mjs
└── transformers/          # Transformers.js WASM files (auto-downloaded)
```

## Permissions Explained

- **storage** - Save user preferences
- **tabs** - Access current tab information
- **activeTab** - Read content from the active tab
- **scripting** - Inject content script for text extraction
- **offscreen** - Create offscreen document for AI processing
- **huggingface.co** - Download AI model files (first use only)

## Browser Compatibility

- ✅ Chrome 116+ (Manifest V3 with offscreen documents)
- ✅ Edge 116+ (Chromium-based)
- ❌ Firefox (different extension API)
- ❌ Safari (different extension API)

## Performance

- **First use**: ~2-5 seconds to download model files (~25MB)
- **Subsequent uses**: Instant (models cached locally)
- **Short articles** (<2000 words): 2-5 seconds
- **Long articles** (5000+ words): 30-60 seconds
- **Memory usage**: ~200-400MB while processing

## Privacy

This extension is designed with privacy as the top priority:

- ✅ All processing happens locally in your browser
- ✅ No data sent to external servers (except initial model download from HuggingFace)
- ✅ No API keys required
- ✅ No user tracking or analytics
- ✅ No data collection

## Limitations

- Models run locally, so performance depends on your device
- Very long documents (10,000+ words) may take 1-2 minutes to process
- Some websites with complex layouts may not extract perfectly
- PDFs with scanned images (not searchable text) won't work
- Requires internet connection for first-time model download only

## Troubleshooting

### "No text extracted" error
- The page may not contain article content
- Try a different page or article
- Check browser console (F12) for detailed error messages

### Summarization is slow
- Normal for long articles (be patient!)
- First-time use requires model download
- Close other tabs to free up memory

### Extension won't load
- Make sure you have Chrome 116 or newer
- Check that all files are in the correct locations
- Look for errors in `chrome://extensions/` developer mode

## Development

### Setup
```bash
# Clone repository
git clone https://github.com/yourusername/smart-article-summarizer.git
cd smart-article-summarizer

# Install PDF.js
# Download from https://github.com/mozilla/pdf.js/releases
# Place pdf.mjs and pdf.worker.mjs in pdf-lib/

# Load in Chrome
# Go to chrome://extensions/, enable Developer Mode, click "Load unpacked"
```

### Making Changes

1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

- **DistilBART Model** - Hugging Face
- **Transformers.js** - Xenova
- **PDF.js** - Mozilla Foundation
- **NLP Dictionaries** - Derived from NLTK and custom word lists

## Support

- 🐛 Report bugs via [GitHub Issues](https://github.com/yourusername/smart-article-summarizer/issues)
- 💬 Discussion and questions via [GitHub Discussions](https://github.com/yourusername/smart-article-summarizer/discussions)
- ⭐ Star the repo if you find it useful!

## Roadmap

- [ ] Add support for more languages
- [ ] Custom summary length options
- [ ] Save and export summaries
- [ ] Dark mode UI
- [ ] Firefox and Safari versions
- [ ] Multiple model options (user choice)
- [ ] Batch summarization for multiple tabs

---

**Made with ❤️ for privacy-conscious readers who want to quickly understand web content**