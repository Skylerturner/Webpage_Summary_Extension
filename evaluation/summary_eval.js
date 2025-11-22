// basic eval. add more evaluation metrics like ROGUE, BLEU or embedded similarity for better metrics

// evaluation/eval-summary.js
import fs from 'fs';

const generated = fs.readFileSync('./sample-articles/generated.txt', 'utf-8');
const reference = fs.readFileSync('./sample-articles/reference.txt', 'utf-8');

// Simple keyword overlap score
function scoreSummary(generated, reference) {
    const genWords = new Set(generated.toLowerCase().split(/\s+/));
    const refWords = new Set(reference.toLowerCase().split(/\s+/));
    const common = [...genWords].filter(w => refWords.has(w));
    return (common.length / refWords.size) * 100;
}

console.log(`Keyword overlap: ${scoreSummary(generated, reference).toFixed(2)}%`);
