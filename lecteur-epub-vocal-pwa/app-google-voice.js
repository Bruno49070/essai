function isGoogleFrenchVoice(voice) {
  const name = String((voice && voice.name) || '').toLowerCase();
  const uri = String((voice && voice.voiceURI) || '').toLowerCase();
  const lang = String((voice && voice.lang) || '').toLowerCase();
  return lang.startsWith('fr') && (name.includes('google') || uri.includes('google'));
}

function sortGoogleFrenchVoices(list) {
  return list.slice().sort((a, b) => {
    const al = String(a.lang || '').toLowerCase();
    const bl = String(b.lang || '').toLowerCase();
    if (al === 'fr-fr' && bl !== 'fr-fr') return -1;
    if (bl === 'fr-fr' && al !== 'fr-fr') return 1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function loadVoices() {
  const allVoices = speechSynthesis.getVoices();
  voices = sortGoogleFrenchVoices(allVoices.filter(isGoogleFrenchVoice));
  voiceSelect.innerHTML = '';

  if (!voices.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Aucune voix Google française disponible';
    voiceSelect.appendChild(option);
    setStatus('Aucune voix Google française détectée. Vérifie les voix de synthèse vocale dans les réglages Android.');
    return;
  }

  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = voice.name + ' (' + voice.lang + ')';
    voiceSelect.appendChild(option);
  });

  const savedVoiceName = localStorage.getItem('epubVoiceReader.voiceName');
  const savedIndex = savedVoiceName ? voices.findIndex((voice) => voice.name === savedVoiceName) : -1;
  voiceSelect.value = savedIndex >= 0 ? String(savedIndex) : '0';
}

function speakCurrentChunk() {
  if (!chunks[currentChunkIndex]) {
    goNextChapter(true);
    return;
  }

  const selectedVoice = voices[Number(voiceSelect.value)];
  if (!selectedVoice) {
    setStatus('Aucune voix Google française disponible pour lancer la lecture.');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
  utterance.voice = selectedVoice;
  utterance.rate = Number(rateRange.value || 1);
  utterance.pitch = voiceEnhancer.pitch;
  utterance.volume = 1;
  utterance.lang = selectedVoice.lang || 'fr-FR';

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
    setStatus('Erreur pendant la lecture avec la voix Google française. Essaie de baisser la vitesse.');
  };

  speechSynthesis.speak(utterance);
  updateProgress();
  renderBookInfo();
  setStatus('Lecture en cours avec la voix Google française.');
}

function testVoice() {
  speechSynthesis.cancel();
  const selectedVoice = voices[Number(voiceSelect.value)];
  if (!selectedVoice) {
    setStatus('Aucune voix Google française disponible pour le test.');
    return;
  }
  const sample = 'Ceci est un test de lecture avec la voix Google française. La vitesse et la tonalité peuvent être ajustées.';
  const utterance = new SpeechSynthesisUtterance(sample);
  utterance.voice = selectedVoice;
  utterance.rate = Number(rateRange.value || 1);
  utterance.pitch = voiceEnhancer.pitch;
  utterance.lang = selectedVoice.lang || 'fr-FR';
  speechSynthesis.speak(utterance);
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();
