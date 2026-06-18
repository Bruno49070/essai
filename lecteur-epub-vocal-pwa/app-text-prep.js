function normalizeForSpeech(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/\bM\.\s+/g, 'Monsieur ')
    .replace(/\bMM\.\s+/g, 'Messieurs ')
    .replace(/\bMme\s+/g, 'Madame ')
    .replace(/\bMmes\s+/g, 'Mesdames ')
    .replace(/\bMlle\s+/g, 'Mademoiselle ')
    .replace(/\bDr\s+/g, 'Docteur ')
    .replace(/\bPr\s+/g, 'Professeur ')
    .replace(/\bSt\s+/g, 'Saint ')
    .replace(/\bSte\s+/g, 'Sainte ')
    .replace(/\bn°\s*/gi, 'numéro ')
    .replace(/\betc\.\s*/gi, 'etcetera. ')
    .replace(/\bc.-à-d\.\s*/gi, 'c’est-à-dire ')
    .replace(/\bav\.\s+/gi, 'avenue ')
    .replace(/\bbd\.\s+/gi, 'boulevard ')
    .replace(/\brd\.\s+/gi, 'rond-point ')
    .replace(/\bchap\.\s+/gi, 'chapitre ')
    .replace(/\bp\.\s*(\d+)/gi, 'page $1')
    .replace(/\b(\d+)\s*%/g, '$1 pour cent')
    .replace(/\b(\d+)\s*€/g, '$1 euros')
    .replace(/\b(\d+)\s*km\b/gi, '$1 kilomètres')
    .replace(/\b(\d+)\s*m²\b/gi, '$1 mètres carrés')
    .replace(/\b(\d+)\s*m3\b/gi, '$1 mètres cubes')
    .replace(/\b(\d+)\s*h\s*(\d{2})\b/g, '$1 heures $2')
    .replace(/\b(\d+)h\b/g, '$1 heures')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([.!?])\s+/g, '$1 ')
    .replace(/([:;])\s+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceWeight(text) {
  let weight = String(text || '').length;
  if (/[!?]/.test(text)) weight += 80;
  if (/"/.test(text)) weight += 50;
  if (/:/.test(text)) weight += 40;
  return weight;
}

function splitText(text) {
  const source = normalizeForSpeech(text);
  const profile = voiceEnhancer && voiceEnhancer.profile ? voiceEnhancer.profile : 'natural';
  const max = profile === 'stable' ? 760 : profile === 'expressive' ? 250 : 380;
  const pieces = source.match(/[^.!?;:]+[.!?;:]?|.+$/g) || [source];
  const result = [];
  let current = '';
  let currentWeight = 0;

  for (const raw of pieces) {
    const piece = raw.trim();
    if (!piece) continue;
    const addedWeight = sentenceWeight(piece);
    if (current && currentWeight + addedWeight > max) {
      result.push(current.trim());
      current = piece;
      currentWeight = addedWeight;
    } else {
      current = `${current} ${piece}`.trim();
      currentWeight += addedWeight;
    }
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function reloadPreparedText() {
  if (typeof reloadCurrentChapterKeepingPosition === 'function') {
    reloadCurrentChapterKeepingPosition();
  }
}

setTimeout(reloadPreparedText, 150);
