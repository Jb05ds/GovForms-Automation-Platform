const Fuse = require("fuse.js");

const STOPWORDS = new Set(["for", "of", "the", "and", "to", "a", "an", "in", "on", "at", "by", "or", "with", "under", "from"]);

const MIN_SHORT_QUERY_TOKENS = 2;
const MAX_SHORT_QUERY_TOKENS = 3;

function normalizeText(text) {
  if (!text) return "";
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => (w.length > 3 ? w.replace(/ies$/, "y").replace(/s$/, "") : w))
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function dice(aSet, bSet) {
  if (!aSet.size || !bSet.size) return 0;
  let shared = 0;
  for (const t of aSet) if (bSet.has(t)) shared++;
  return (2 * shared) / (aSet.size + bSet.size);
}

function createRanker(forms) {
  const prepared = forms.map(f => ({
    form: f,
    _normalized_name: normalizeText(f.form_name),
    _normalized_text: normalizeText(f.first_page_text),
    _tokens: new Set(tokenize(f.form_name)),
  }));

  const fuse = new Fuse(prepared, {
    keys: [
      { name: "_normalized_name", weight: 0.7 },
      { name: "_normalized_text", weight: 0.3 },
    ],
    includeScore: true,
    threshold: 0.6,
    ignoreLocation: true,
  });

  return function rank(queryText, limit = 3) {
    const query = normalizeText(queryText);
    if (!query) return [];

    const fuseConf = new Map();
    for (const r of fuse.search(query)) fuseConf.set(r.item, Math.round((1 - r.score) * 100));

    const qTokens = new Set(tokenize(query));
    const shortQuery = qTokens.size >= MIN_SHORT_QUERY_TOKENS && qTokens.size <= MAX_SHORT_QUERY_TOKENS;

    const ranked = [];
    for (const p of prepared) {
      const fuseConfidence = fuseConf.get(p) ?? 0;
      let wordConfidence = 0;
      if (shortQuery && [...qTokens].every(t => p._tokens.has(t))) {
        wordConfidence = Math.round(100 * dice(qTokens, p._tokens));
      }
      const confidence = Math.max(fuseConfidence, wordConfidence);
      if (confidence > 0) ranked.push({ form: p.form, confidence, fuseConfidence, wordConfidence });
    }

    ranked.sort((a, b) => b.confidence - a.confidence || b.fuseConfidence - a.fuseConfidence);
    return ranked.slice(0, limit);
  };
}

module.exports = { createRanker, normalizeText };