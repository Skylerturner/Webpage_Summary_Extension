// pdf-helper.js
// Extracts text from PDF documents using PDF.js

/**
 * Extracts text content from a PDF URL
 * @param {string} pdfUrl - The URL of the PDF to extract
 * @returns {Promise<string>} - The extracted text from all pages
 */
export async function extractPDFText(pdfUrl) {
  try {
    console.log("Fetching PDF from:", pdfUrl);
    
    // Dynamically import PDF.js library
    const pdfjsLib = await import('./pdf-lib/pdf.mjs');
    
    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf-lib/pdf.worker.mjs');
    
    // Fetch the PDF file
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`PDF downloaded: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    console.log(`PDF loaded successfully: ${pdf.numPages} pages`);
    
    // Extract text from all pages
    const textPages = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Concatenate all text items from the page
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      textPages.push(pageText);
      
      // Log progress every 5 pages
      if (pageNum % 5 === 0 || pageNum === pdf.numPages) {
        console.log(`Processed ${pageNum}/${pdf.numPages} pages`);
      }
    }
    
    // Combine all pages with paragraph breaks
    const fullText = textPages.join('\n\n').trim();
    
    console.log(`✅ PDF text extraction complete: ${fullText.length} characters`);
    return fullText;
    
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract PDF text: ${error.message}`);
  }
}