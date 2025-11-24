// pdf-helper.js
// Helper functions for extracting text from PDFs using PDF.js

/**
 * Extracts text from a PDF URL
 * @param {string} pdfUrl - The URL of the PDF to extract
 * @returns {Promise<string>} - The extracted text
 */
export async function extractPDFText(pdfUrl) {
    try {
        console.log("Fetching PDF from:", pdfUrl);
        
        // Import PDF.js dynamically
        const pdfjsLib = await import('./pdf-lib/pdf.mjs');
        
        // Set worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf-lib/pdf.worker.mjs');
        
        // Fetch the PDF
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log(`PDF downloaded: ${arrayBuffer.byteLength} bytes`);
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        console.log(`PDF loaded: ${pdf.numPages} pages`);
        
        // Extract text from all pages
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Concatenate text items
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ');
            
            fullText += pageText + '\n\n';
            
            if (pageNum % 5 === 0) {
                console.log(`Processed ${pageNum}/${pdf.numPages} pages`);
            }
        }
        
        console.log(`✅ PDF text extracted: ${fullText.length} characters`);
        return fullText.trim();
        
    } catch (error) {
        console.error("PDF extraction failed:", error);
        throw new Error(`Failed to extract PDF text: ${error.message}`);
    }
}