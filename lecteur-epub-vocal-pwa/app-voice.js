const voiceEnhancer = {
  pitch: Number(localStorage.getItem('epubVoiceReader.pitch') || '1'),
  profile: localStorage.getItem('epubVoiceReader.voiceProfile') || 'natural'
};

function createVoiceControls() {
  if (document.querySelector('#pitchRange')) return;
  const grid = document.querySelector('.grid');
  if (!grid) return;

  const pitchBox = document.createElement('div');
  pitchBox.innerHTML = `
    <label for="pitchRange">Tonalité : <span id="pitchValue">${voiceEnhancer.pitch.toFixed(2)}</span></label>
    <input id="pitchRange" type="range" min="0.80" max="1.25" step="0.05" value="${voiceEnhancer.pitch}">`;
  grid.appendChild(pitchBox);

  const profileBox = document.createElement('div');
  profileBox.innerHTML = `
    <label for="voiceProfile">Fluidité</label>
    <select id="voiceProfile">
      <option value="natural">Naturelle, recommandée</option>
      <option value="stable">Stable</option>
      <option value="expressive">Plus expressive</option>
    </select>`;
  grid.appendChild(profileBox);

  const testButton = document.createElement('button');
  testButton.type = 'button';
  testButton.className = 'secondary';
  testButton.textContent = 'Tester la voix';
  testButton.addEventListener('click', testVoice);
  const row = document.querySelector('.row');
  if (row) row.appendChild(testButton);

  const pitchRange = document.querySelector('#pitchRange');
  const pitchValue = document.querySelector('#pitchValue');
  const profile = document.querySelector('#voiceProfile');
  profile.value = voiceEnhancer.profile;

  pitchRange.addEventListener('input', () => {
    voiceEnhancer.pitch = Number(pitchRange.value);
    pitchValue.textContent = voiceEnhancer.pitch.toFixed(2);
    localStorage.setItem('epubVoiceReader.pitch', String(voiceEnhancer.pitch));
  });

  profile.addEventListener('change', () => {
    voiceEnhancer.profile = profile.value;
    localStorage.setItem('epubVoiceReader.voiceProfile', voiceEnhancer.profile);
    reloadCurrentChapterKeepingPosition();
  });
}

function scoreVoice(voice) {
  const name = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
  const lang = String(voice.lang || '').toLowerCase();
  let score = 0;
  if (lang.startsWith('fr')) score += 100;
  if (lang === 'fr-fr') score += 30;
  if (name.includes('google')) score += 25;
  if (name.includes('microsoft')) score += 22;
  if (name.includes('natural')) score += 20;
  if (name.includes('online')) score += 16;
  if (name.includes('enhanced')) score += 16;
  if (name.includes('samsung')) score += 12;
  if (name.includes('thomas')) score += 10;
  if (name.includes('audrey')) score += 10;
  if (name.includes('denise')) score += 10;
  if (name.includes('compact')) score -= 20;
  if (name.includes('default')) score -= 4;
  return score;
}

function loadVoices() {
  const available = speechSynthesis.getVoices();
  voices = available.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a));
  voiceSelect.innerHTML = '';

  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    const recommended = index === 0 && String(voice.lang || '').toLowerCase().startsWith('fr') ? ' · recommandée' : '';
    option.textContent = `${voice.name} (${voice.lang})${recommended}`;
    voiceSelect.appendChild(option);
  });

  const savedVoiceName = localStorage.getItem('epubVoiceReader.voiceName');
  const savedIndex = savedVoiceName ? voices.findIndex((voice) => voice.name === savedVoiceName) : -1;
  if (savedIndex >= 0) voiceSelect.value = String(savedIndex);
  else voiceSelect.value = '0';
}

function normalizeForSpeech(text) {
  return String(text || '')
    .replace(/\bM\.\s+/g, 'Monsieur ')
    .replace(/\bMme\s+/g, 'Madame ')
    .replace(/\bMlle\s+/g, 'Mademoiselle ')
    .replace(/\bDr\s+/g, 'Docteur ')
    .replace(/\bPr\s+/g, 'Professeur ')
    .replace(/\bSt\s+/g, 'Saint ')
    .replace(/\bSte\s+/g, 'Sainte ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([.!?])\s+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitText(text) {
  const source = normalizeForSpeech(text);
  const profile = voiceEnhancer.profile;
  const max = profile === 'stable' ? 700 : profile === 'expressive' ? 280 : 430;
  const sentences = source.match(/[^.!?;:]+[.!?;:]?|.+$/g) || [source];
  const result = [];
  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if ((current + ' ' + sentence).length > max && current.trim()) {
      result.push(current.trim());
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function speakCurrentChunk() {
  if (!chunks[currentChunkIndex]) {
    goNextChapter(true);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
  const selectedVoice = voices[Number(voiceSelect.value)];
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = Number(rateRange.value || 1);
  utterance.pitch = voiceEnhancer.pitch;
  utterance.volume = 1;
  utterance.lang = selectedVoice ? selectedVoice.lang : 'fr-FR';

  utterance.onend = () => {
    if (!isReading) return;
    currentChunkIndex += 1;
    persistPosition();
    updateProgress();
    renderBookInfo();
    if (currentChunkIndex < chunks.length) speakCurrentChunk();
    else goNextChapter(true);
  };

  utterance.onerror = (event) => {
    console.error(event);
    setStatus('Erreur pendant la lecture vocale. Essaie une autre voix ou baisse la vitesse.');
  };

  speechSynthesis.speak(utterance);
  updateProgress();
  renderBookInfo();
  setStatus('Lecture en cours...');
}

function testVoice() {
  speechSynthesis.cancel();
  const sample = 'Ceci est un test de lecture vocale. La voix, la vitesse et la tonalité peuvent être ajustées pour rendre l’écoute plus agréable.';
  const utterance = new SpeechSynthesisUtterance(sample);
  const selectedVoice = voices[Number(voiceSelect.value)];
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = Number(rateRange.value || 1);
  utterance.pitch = voiceEnhancer.pitch;
  utterance.lang = selectedVoice ? selectedVoice.lang : 'fr-FR';
  speechSynthesis.speak(utterance);
}

function reloadCurrentChapterKeepingPosition() {
  if (!chapters[currentChapterIndex]) return;
  const savedChunk = currentChunkIndex;
  const text = chapters[currentChapterIndex].text || '';
  chunks = splitText(text);
  currentChunkIndex = Math.min(savedChunk, Math.max(chunks.length - 1, 0));
  persistPosition();
  updateProgress();
}

voiceSelect.addEventListener('change', () => {
  const selectedVoice = voices[Number(voiceSelect.value)];
  if (selectedVoice) localStorage.setItem('epubVoiceReader.voiceName', selectedVoice.name);
});

createVoiceControls();
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();
reloadCurrentChapterKeepingPosition();
