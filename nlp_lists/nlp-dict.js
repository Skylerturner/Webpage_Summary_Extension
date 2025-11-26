// nlp-dict.js
// Word lists for NLP analysis

export const STOPWORDS = new Set([
  // Articles
  "a", "an", "the",
  
  // Pronouns
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "mine", "yours", "hers", "ours", "theirs",
  "myself", "yourself", "himself", "herself", "itself", "ourselves", "themselves",
  "this", "that", "these", "those",
  
  // Prepositions
  "in", "on", "at", "to", "for", "with", "from", "by", "about", "as", "into", "like",
  "through", "after", "over", "between", "out", "against", "during", "without", "before",
  "under", "around", "among", "of", "off", "up", "down", "above", "below", "near",
  
  // Conjunctions
  "and", "or", "but", "nor", "so", "yet", "because", "although", "while", "if", "when",
  "where", "since", "unless", "than", "whether",
  
  // Auxiliary/Modal verbs
  "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "should", "could", "may", "might", "must",
  "can", "shall",
  
  // Common verbs
  "get", "got", "make", "made", "go", "went", "come", "came", "take", "took",
  "see", "saw", "know", "knew", "think", "thought", "say", "said", "tell", "told",
  "give", "gave", "find", "found", "use", "used", "work", "worked",
  
  // Adverbs
  "very", "also", "too", "so", "just", "now", "then", "there", "here", "how",
  "why", "what", "which", "who", "whom", "whose", "where", "when", "more", "most",
  "much", "many", "some", "any", "all", "both", "each", "few", "less", "little",
  "only", "own", "other", "such", "quite", "rather", "really", "well", "still",
  "even", "again", "back", "ever", "never", "always", "often", "sometimes",
  
  // Determiners/Quantifiers
  "no", "not", "every", "either", "neither", "another", "same", "several",
  
  // Question words
  "who", "what", "where", "when", "why", "how", "which",
  
  // Contractions (without apostrophes for matching)
  "dont", "doesnt", "didnt", "wont", "wouldnt", "shouldnt", "couldnt",
  "cant", "im", "youre", "hes", "shes", "its", "were", "theyre",
  "ive", "youve", "weve", "theyve", "isnt", "arent", "wasnt", "werent",
  
  // Numbers (as words)
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  
  // Other common non-content words
  "yes", "no", "ok", "okay", "please", "thanks", "thank", "welcome"
]);

export const POSITIVE_WORDS = new Set([
  "good", "great", "excellent", "positive", "happy", "success", "benefit", "improve",
  "amazing", "wonderful", "fantastic", "outstanding", "brilliant", "superb", "best",
  "better", "love", "perfect", "beautiful", "awesome", "excited", "thrilled",
  "delighted", "pleased", "satisfied", "helpful", "effective", "valuable", "innovative",
  "productive", "efficient", "reliable", "proven", "strong", "powerful", "advanced"
]);

export const NEGATIVE_WORDS = new Set([
  "bad", "poor", "negative", "fail", "problem", "worse", "decline", "issue",
  "terrible", "horrible", "awful", "disappointing", "failed", "failure", "weak",
  "broken", "flawed", "defective", "damaged", "harmful", "dangerous", "risky",
  "difficult", "challenging", "struggling", "crisis", "critical", "severe",
  "worst", "hate", "dislike", "unfortunate", "concern", "worried", "fear"
]);

export const SUBJECTIVE_WORDS = new Set([
  "i", "we", "my", "our", "believe", "think", "feel", "opinion",
  "me", "us", "mine", "ours", "myself", "ourselves", "personally",
  "seems", "appears", "probably", "possibly", "maybe", "perhaps",
  "assume", "suppose", "guess", "imagine", "suspect", "suggest"
]);