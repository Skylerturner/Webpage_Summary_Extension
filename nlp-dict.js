// nlp-dict.js
// Word lists for NLP analysis with weighted subjectivity scoring

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

// Weighted subjectivity indicators
// Higher weight = stronger indicator of subjective content
export const SUBJECTIVITY_INDICATORS = new Map([
  // ========================================
  // STRONG OPINION MARKERS (Weight: 3)
  // ========================================
  ['believe', 3],
  ['think', 3],
  ['feel', 3],
  ['opinion', 3],
  ['guess', 3],
  ['assume', 3],
  ['suppose', 3],
  ['reckon', 3],
  ['imagine', 3],
  ['consider', 3],
  ['suspect', 3],
  
  // ========================================
  // HEDGES & UNCERTAINTY (Weight: 2)
  // ========================================
  ['seems', 2],
  ['appears', 2],
  ['probably', 2],
  ['possibly', 2],
  ['perhaps', 2],
  ['maybe', 2],
  ['might', 2],
  ['likely', 2],
  ['unlikely', 2],
  ['somewhat', 2],
  ['rather', 2],
  
  // ========================================
  // EMPHATIC WORDS (Weight: 2.5)
  // ========================================
  ['clearly', 2.5],
  ['obviously', 2.5],
  ['certainly', 2.5],
  ['definitely', 2.5],
  ['surely', 2.5],
  ['absolutely', 2.5],
  ['undoubtedly', 2.5],
  ['unquestionably', 2.5],
  
  // ========================================
  // EVALUATIVE ADVERBS (Weight: 2)
  // ========================================
  ['fortunately', 2],
  ['unfortunately', 2],
  ['surprisingly', 2],
  ['shockingly', 2],
  ['disappointingly', 2],
  ['thankfully', 2],
  ['sadly', 2],
  ['happily', 2],
  ['regrettably', 2],
  ['ironically', 2],
  
  // ========================================
  // PERSONAL PRONOUNS (Weight: 1)
  // ========================================
  ['i', 1],
  ['we', 1],
  ['my', 1],
  ['our', 1],
  ['me', 1],
  ['us', 1],
  ['mine', 1],
  ['ours', 1],
  ['myself', 1],
  ['ourselves', 1],
  
  // ========================================
  // MODAL VERBS (Weight: 1)
  // ========================================
  ['could', 1],
  ['would', 1],
  ['should', 1],
  ['may', 1],
  
  // ========================================
  // QUALIFIER WORDS (Weight: 1.5)
  // ========================================
  ['quite', 1.5],
  ['fairly', 1.5],
  ['pretty', 1.5],
  ['slightly', 1.5],
  ['extremely', 1.5],
  ['incredibly', 1.5],
  ['totally', 1.5],
  ['completely', 1.5],
  
  // ========================================
  // COMPARATIVE SUBJECTIVES (Weight: 2)
  // ========================================
  ['better', 2],
  ['worse', 2],
  ['best', 2],
  ['worst', 2],
  ['superior', 2],
  ['inferior', 2],
  ['preferable', 2],
  
  // ========================================
  // SUGGESTION/RECOMMENDATION (Weight: 2)
  // ========================================
  ['suggest', 2],
  ['recommend', 2],
  ['advise', 2],
  ['propose', 2],
  ['urge', 2],
  
  // ========================================
  // PERCEPTION VERBS (Weight: 1.5)
  // ========================================
  ['perceive', 1.5],
  ['sense', 1.5],
  ['notice', 1.5],
  ['realize', 1.5],
  ['understand', 1.5]
]);

// Objective indicators (for balance)
// These reduce subjectivity score
export const OBJECTIVITY_INDICATORS = new Set([
  // Factual language
  'according',
  'research',
  'study',
  'data',
  'evidence',
  'report',
  'analysis',
  'findings',
  'results',
  
  // Scientific verbs
  'measured',
  'observed',
  'recorded',
  'documented',
  'demonstrated',
  'showed',
  'found',
  'discovered',
  'revealed',
  
  // Neutral reporting verbs
  'stated',
  'reported',
  'indicated',
  'noted',
  'described',
  'explained',
  
  // Quantitative terms
  'percent',
  'percentage',
  'approximately',
  'roughly',
  'exactly',
  'precisely'
]);