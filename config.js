// config.js
// Extension configuration constants

// AI Model Configuration
export const MODEL_ID = "Xenova/distilbart-cnn-6-6";
export const MODEL_DISPLAY_NAME = "DistilBART-CNN-6-6";
export const MODEL_DESCRIPTION = "Fast, private summarization running locally in your browser";

// Text Processing Limits
export const MIN_ARTICLE_LENGTH = 500;
export const MAX_NLP_TEXT_LENGTH = 50000;
export const MIN_PARAGRAPH_LENGTH = 50;
export const SHORT_CONTENT_THRESHOLD = 200;

// Timeouts (in milliseconds)
export const PDF_EXTRACTION_TIMEOUT = 90000;  // 90 seconds
export const SUMMARIZATION_TIMEOUT = 180000;  // 3 minutes
export const NLP_TIMEOUT = 30000;              // 30 seconds
export const CONTENT_SCRIPT_TIMEOUT = 10000;   // 10 seconds

// Debug flag - set to true for development logging
export const DEBUG = false;