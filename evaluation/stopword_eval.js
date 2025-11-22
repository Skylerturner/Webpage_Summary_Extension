// evaluation/eval-stopwords.js
import { removeStopwords } from 'stopword';
import fs from 'fs';

const sampleText = fs.readFileSync('./sample-articles/article1.txt', 'utf-8');

// Token estimator (~4 chars per token)
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

// Stopword strategies
function aggressive(text) {
    return removeStopwords(text.split(/\s+/)).join(" ");
}

function light(text) {
    // Keep prepositions/articles but remove very common low-value words
    const customStopwords = ["and", "or", "but", "so"];
    return text.split(/\s+/).filter(w => !customStopwords.includes(w.toLowerCase())).join(" ");
}

function none(text) {
    return text;
}

// Evaluate
const strategies = { aggressive, light, none };
for (let [name, fn] of Object.entries(strategies)) {
    const cleaned = fn(sampleText);
    const tokens = estimateTokens(cleaned);
    console.log(`Strategy: ${name}`);
    console.log(`Tokens: ${tokens}`);
    console.log('---');
}


// OpenAI provides tiktoken to count exactly how many tokens a string will use with a specific model
import { encoding_for_model } from "@dqbd/tiktoken";

const enc = encoding_for_model("gpt-4o-mini");
const text = "The cat sat on the mat.";
const tokens = enc.encode(text);

console.log("Token count:", tokens.length);


// Hugging Face tokenizers (like t5-small or bart-cnn) have built-in tokenizer objects
import { AutoTokenizer } from '@xenova/transformers';

async function countTokens(text) {
    const tokenizer = await AutoTokenizer.from_pretrained("t5-small");
    const encoded = await tokenizer.encode(text);
    return encoded.length; // Number of tokens
}
