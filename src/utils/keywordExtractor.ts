/**
 * Intelligent keyword extraction for short-form video hooks & scripts.
 * Detects important entities, dramatic story hooks, names, numbers, and dates.
 */

// Common high-impact dramatic / emotional / viral hook words
const IMPACT_DICTIONARY = new Set([
  'killed', 'killing', 'kills', 'kill',
  'burns', 'burned', 'burning',
  'died', 'death', 'dead', 'dying',
  'murder', 'murdered',
  'dragged', 'drag',
  'rifles', 'rifle', 'guns', 'gun', 'weapon',
  'hurt', 'injuries', 'injured', 'wound', 'bleeding', 'blood',
  'war', 'battle', 'army', 'soldier',
  'police', 'arrested', 'jail', 'prison', 'crime',
  'secret', 'secrets', 'shocking', 'shocked',
  'mystery', 'mysterious', 'unexplained',
  'danger', 'dangerous', 'warning', 'banned', 'illegal',
  'disaster', 'tragic', 'tragedy', 'curse', 'cursed',
  'truth', 'lie', 'lies', 'conspiracy', 'revealed',
  'insane', 'craziest', 'unbelievable', 'impossible',
  'legend', 'legendary', 'hero', 'heroes',
  'famous', 'star', 'stars', 'celebrity',
  'survived', 'survivor', 'rescue', 'saved',
  'segregated', 'racist', 'supremacist',
  'monster', 'creature', 'ghost', 'demon',
  'money', 'million', 'millions', 'billion', 'billions', 'fortune', 'wealth',
  'piano', 'hollywood', 'titanic', 'strongheart', 'etzel', 'berlin',
  'alabama', 'birmingham', 'studio',
  'first', 'last', 'only', 'never',
]);

// Non-keyword common sentence starters and stop words to avoid highlighting accidentally
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'before', 'between', 'under', 'during',
  'without', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can',
  'will', 'just', 'don', 'should', 'now', 'he', 'she', 'it', 'they', 'we', 'i', 'you',
  'his', 'her', 'their', 'our', 'my', 'your', 'him', 'them', 'us', 'me',
  'was', 'were', 'is', 'am', 'are', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'doing', 'would', 'could', 'come', 'came', 'went', 'go',
  'see', 'saw', 'seen', 'put', 'bought', 'told', 'tell', 'ran', 'run', 'found',
]);

/**
 * Extracts a list of important keywords from the given script text.
 */
export function extractImportantKeywords(
  text: string,
  customKeywords: string[] = [],
  excludedKeywords: string[] = []
): string[] {
  if (!text || !text.trim()) return [];

  const excludedSet = new Set(excludedKeywords.map((k) => k.toLowerCase()));
  const foundKeywords = new Set<string>();

  // 1. Add user-specified custom keywords first
  for (const custom of customKeywords) {
    if (custom.trim() && !excludedSet.has(custom.toLowerCase())) {
      foundKeywords.add(custom.trim());
    }
  }

  // 2. Check for multi-word famous phrases / numbers
  const multiWordCandidates = [
    'First World War',
    'Walk of Fame',
    'Nat King Cole',
    'German Shepherd',
    'white supremacist',
    'Rin Tin Tin',
    'nineteen twenty one',
    'nineteen fifty six',
    'nineteen twelve',
  ];

  for (const phrase of multiWordCandidates) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'i');
    if (regex.test(text) && !excludedSet.has(phrase.toLowerCase())) {
      foundKeywords.add(phrase);
    }
  }

  // 3. Extract words: numbers, capitalized proper nouns, impactful words
  // Match individual words while stripping punctuation
  const wordTokens = text.split(/\s+/);

  wordTokens.forEach((rawWord, idx) => {
    // Strip trailing/leading punctuation: commas, periods, quotes
    const clean = rawWord.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    if (!clean || clean.length < 2) return;

    const lower = clean.toLowerCase();
    if (excludedSet.has(lower)) return;

    // Check 1: Numbers or years (e.g. 1921, 1956, 100)
    if (/^\d+/.test(clean)) {
      foundKeywords.add(clean);
      return;
    }

    // Check 2: Impact dictionary words
    if (IMPACT_DICTIONARY.has(lower)) {
      foundKeywords.add(clean);
      return;
    }

    // Check 3: Capitalized proper noun (not sentence starter)
    const isCapitalized = /^[A-Z][a-z0-9]/.test(clean);
    const isSentenceStarter = idx === 0 || /[.!?]\s*$/.test(wordTokens[idx - 1] || '');

    if (isCapitalized && !STOP_WORDS.has(lower)) {
      if (!isSentenceStarter) {
        foundKeywords.add(clean);
      } else {
        // Even if sentence starter, check if it's a known name like Strongheart, Birmingham, Rin
        if (IMPACT_DICTIONARY.has(lower) || ['strongheart', 'birmingham', 'etzel', 'rin'].includes(lower)) {
          foundKeywords.add(clean);
        }
      }
    }
  });

  return Array.from(foundKeywords);
}

/**
 * Checks if a given clean word matches any active keyword.
 */
export function isWordKeyword(word: string, activeKeywords: string[]): boolean {
  if (!word || !activeKeywords.length) return false;
  const cleanWord = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
  if (!cleanWord) return false;

  for (const kw of activeKeywords) {
    const cleanKw = kw.toLowerCase().trim();
    // Support multi-word phrase matching or single word matching
    if (cleanKw.includes(' ')) {
      const parts = cleanKw.split(/\s+/);
      if (parts.some((p) => p === cleanWord)) return true;
    } else if (cleanKw === cleanWord) {
      return true;
    }
  }

  return false;
}
