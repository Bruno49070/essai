const $ = (selector) => document.querySelector(selector);

const BOOKS_KEY = 'epubVoiceReader.books.v4';
const CHARS_PER_MINUTE = 900;

const fileInput = $('#fileInput');
const libraryEl = $('#library');
const statusEl = $('#status');
const chapterSelect = $('#chapterSelect');
const voiceSelect = $('#voiceSelect');
const rateRange = $('#rateRange');
const rateValue = $('#rateValue');
const bookInfo = $('#bookInfo');
const chapterText = $('#chapterText');
const progressBar = $('#progressBar');
const progressText = $('#progressText');
const prevBtn = $('#prevBtn');
const playBtn = $('#playBtn');
const pauseBtn = $('#pauseBtn');
const resumeBtn = $('#resumeBtn');
const stopBtn = $('#stopBtn');
const nextBtn = $('#nextBtn');

let books = [];
let activeBook = null;
let chapters = [];
let chunks = [];
let currentChapterIndex = 0;
let currentChunkIndex = 0;
let voices = [];
let isReading = false;

function setStatus(message) { statusEl.textContent = message; }
function parseXml(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
function localEls(doc, name) { return Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === name); }
function firstLocal(doc, name) { return localEls(doc, name)[0] || null; }
function cleanText(value) { return (value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim(); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function dirname(path) { const index = path.lastIndexOf('/'); return index >= 0 ? path.slice(0, index + 1) : ''; }
function normalizePath(path) { const parts = []; path.split('/').forEach((part) => { if (!part || part === '.') return; if (part === '..') parts.pop(); else parts.push(part); }); return parts.join('/'); }
function sumChars(list) { return (list || []).reduce((total, item) => total + (item.text ? item.text.length : 0), 0); }

function splitText(text, size = 900) {
  const sentences = text.match(/[^.!?;:]+[.!?;:]?|.+$/g) || [text];
  const result = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > size && current.trim()) { result.push(current.trim()); current = sentence; }
    else current += ' ' + sentence;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function saveBooks() {
  const data = books.map((book) => ({
    id: book.id,
    title: book.title,
    fileName: book.fileName,
    chapters: book.chapters,
    cover: book.cover || '',
    totalChars: book.totalChars || sumChars(book.chapters),
    chapter: book.chapter || 0,
    chunk: book.chunk || 0,
    addedAt: book.addedAt,
    lastReadAt: book.lastReadAt || book.addedAt
  }));
  localStorage.setItem(BOOKS_KEY, JSON.stringify(data));
}

function loadBooks() {
  try { books = JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]'); } catch { books = []; }
  books.forEach((book) => { book.totalChars = book.totalChars || sumChars(book.chapters); });
  sortBooks();
  renderLibrary();
  if (books.length) openStoredBook(books[0].id);
}

function sortBooks() { books.sort((a, b) => String(b.lastReadAt || b.addedAt).localeCompare(String(a.lastReadAt || a.addedAt))); }

function getGlobalPosition(book = activeBook) {
  if (!book || !book.chapters?.length) return 0;
  const index = Math.min(book.chapter || 0, book.chapters.length - 1);
  const before = book.chapters.slice(0, index).reduce((total, chapter) => total + chapter.text.length, 0);
  const chapterTextLength = book.chapters[index]?.text?.length || 0;
  const chapterChunks = splitText(book.chapters[index]?.text || '');
  const chunkRatio = chapterChunks.length ? Math.min((book.chunk || 0) / chapterChunks.length, 1) : 0;
  return Math.round(before + chapterTextLength * chunkRatio);
}

function progressForBook(book) {
  const total = Math.max(book.totalChars || sumChars(book.chapters), 1);
  return Math.min(100, Math.round((getGlobalPosition(book) / total) * 100));
}

function formatDate(value) {
  if (!value) return 'Jamais lu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'moins de 1 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

function remainingMinutes() {
  if (!activeBook) return 0;
  const total = Math.max(activeBook.totalChars || sumChars(activeBook.chapters), 1);
  const remaining = Math.max(total - getGlobalPosition(activeBook), 0);
  const rate = Number(rateRange.value || 1);
  return Math.ceil(remaining / (CHARS_PER_MINUTE * rate));
}

function coverHtml(book, large = false) {
  if (book?.cover) {
    const width = large ? 110 : 54;
    const height = large ? 150 : 74;
    return `<img src="${book.cover}" alt="Couverture" style="width:${width}px;height:${height}px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;background:#f8fafc">`;
  }
  const width = large ? 110 : 54;
  const height = large ? 150 : 74;
  return `<div style="width:${width}px;height:${height}px;border-radius:10px;border:1px solid #e5e7eb;background:#f8fafc;display:grid;place-items:center;color:#64748b;font-size:.8rem">EPUB</div>`;
}

function renderLibrary() {
  libraryEl.innerHTML = '';
  if (!books.length) { libraryEl.innerHTML = '<p class="muted">Aucun livre dans la bibliothèque.</p>'; return; }
  books.forEach((book) => {
    const progress = progressForBook(book);
    const status = progress >= 99 ? 'Terminé' : 'En cours';
    const item = document.createElement('div');
    item.className = 'book';
    item.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;min-width:0">
        ${coverHtml(book, false)}
        <div style="min-width:0">
          <strong>${escapeHtml(book.title || book.fileName)}</strong>
          <span>${status}, ${progress} %, chapitre ${(book.chapter || 0) + 1}/${book.chapters?.length || 1}</span>
          <span>Dernière lecture : ${formatDate(book.lastReadAt)}</span>
        </div>
      </div>
      <div class="row">
        <button data-open="${book.id}">Ouvrir</button>
        <button class="danger" data-delete="${book.id}">Supprimer</button>
      </div>`;
    libraryEl.appendChild(item);
  });
  libraryEl.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => openStoredBook(button.dataset.open)));
  libraryEl.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteStoredBook(button.dataset.delete)));
}

function persistPosition() {
  if (!activeBook) return;
  activeBook.chapter = currentChapterIndex;
  activeBook.chunk = currentChunkIndex;
  activeBook.lastReadAt = new Date().toISOString();
  sortBooks();
  saveBooks();
  renderLibrary();
}

function loadVoices() {
  voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.lang.toLowerCase().startsWith('fr')) option.selected = true;
    voiceSelect.appendChild(option);
  });
  const savedVoice = localStorage.getItem('epubVoiceReader.voice');
  if (savedVoice && voices[Number(savedVoice)]) voiceSelect.value = savedVoice;
}

async function extractCover(zip, opfXml, basePath, manifest) {
  let coverId = null;
  const metaCover = localEls(opfXml, 'meta').find((meta) => meta.getAttribute('name') === 'cover');
  if (metaCover) coverId = metaCover.getAttribute('content');
  let coverItem = coverId ? manifest.get(coverId) : null;
  if (!coverItem) coverItem = Array.from(manifest.values()).find((item) => String(item.properties || '').includes('cover-image'));
  if (!coverItem) coverItem = Array.from(manifest.values()).find((item) => /^image\//i.test(item.media) && /cover|couverture/i.test(item.href));
  if (!coverItem || !/^image\//i.test(coverItem.media)) return '';
  const file = zip.file(normalizePath(basePath + coverItem.href));
  if (!file) return '';
  const base64 = await file.async('base64');
  return `data:${coverItem.media};base64,${base64}`;
}

async function parseBookFile(file) {
  if (!window.JSZip) throw new Error('JSZip absent');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('container.xml introuvable');
  const containerXml = parseXml(await containerFile.async('text'));
  const rootFile = firstLocal(containerXml, 'rootfile');
  const opfPath = rootFile && rootFile.getAttribute('full-path');
  if (!opfPath || !zip.file(opfPath)) throw new Error('Fichier OPF introuvable');

  const opfXml = parseXml(await zip.file(opfPath).async('text'));
  const basePath = dirname(opfPath);
  const titleNode = firstLocal(opfXml, 'title');
  const title = cleanText(titleNode ? titleNode.textContent : file.name);

  const manifest = new Map();
  localEls(opfXml, 'item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const media = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';
    if (id && href) manifest.set(id, { href, media, properties });
  });

  const parsedChapters = [];
  let number = 1;
  for (const itemref of localEls(opfXml, 'itemref')) {
    const item = manifest.get(itemref.getAttribute('idref'));
    if (!item) continue;
    if (!/xhtml|html/i.test(item.media) && !/\.x?html?$/i.test(item.href)) continue;
    const htmlFile = zip.file(normalizePath(basePath + item.href));
    if (!htmlFile) continue;
    const html = await htmlFile.async('text');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, nav, header, footer').forEach((el) => el.remove());
    const heading = doc.querySelector('h1, h2, h3, title');
    const label = cleanText(heading ? heading.textContent : `Chapitre ${number}`) || `Chapitre ${number}`;
    const text = cleanText(doc.body ? doc.body.textContent : doc.documentElement.textContent);
    if (text.length > 30) { parsedChapters.push({ label, text }); number += 1; }
  }
  if (!parsedChapters.length) throw new Error('Aucun chapitre texte détecté');

  const cover = await extractCover(zip, opfXml, basePath, manifest).catch(() => '');
  const now = new Date().toISOString();
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    title,
    fileName: file.name,
    chapters: parsedChapters,
    cover,
    totalChars: sumChars(parsedChapters),
    chapter: 0,
    chunk: 0,
    addedAt: now,
    lastReadAt: now
  };
}

async function addBook(file) {
  stopReading(false);
  setStatus('Analyse du livre en cours...');
  const book = await parseBookFile(file);
  books.unshift(book);
  saveBooks();
  renderLibrary();
  openStoredBook(book.id);
  setStatus('Livre ajouté à la bibliothèque.');
}

function openStoredBook(id) {
  const book = books.find((item) => item.id === id);
  if (!book) return;
  stopReading(false);
  activeBook = book;
  chapters = book.chapters || [];
  activeBook.totalChars = activeBook.totalChars || sumChars(chapters);
  currentChapterIndex = Math.min(book.chapter || 0, Math.max(chapters.length - 1, 0));
  currentChunkIndex = book.chunk || 0;
  chapterSelect.innerHTML = '';
  chapters.forEach((chapter, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = chapter.label;
    chapterSelect.appendChild(option);
  });
  chapterSelect.disabled = false;
  enableButtons(true);
  loadChapter(currentChapterIndex, currentChunkIndex);
  setStatus('Livre chargé. Reprise à la dernière position enregistrée.');
}

function deleteStoredBook(id) {
  stopReading(false);
  books = books.filter((book) => book.id !== id);
  if (activeBook?.id === id) {
    activeBook = null; chapters = []; chunks = [];
    chapterSelect.innerHTML = ''; chapterSelect.disabled = true; bookInfo.innerHTML = '';
    chapterText.textContent = 'Le texte du chapitre apparaîtra ici.';
    enableButtons(false); updateProgress();
  }
  saveBooks(); renderLibrary(); setStatus('Livre supprimé de la bibliothèque.');
}

function renderBookInfo() {
  if (!activeBook) { bookInfo.innerHTML = ''; return; }
  const progress = progressForBook(activeBook);
  const chapterNumber = Math.min(currentChapterIndex + 1, chapters.length || 1);
  const status = progress >= 99 ? 'Terminé' : 'En cours';
  bookInfo.innerHTML = `
    <div style="display:flex;gap:14px;align-items:center;margin:8px 0 12px">
      ${coverHtml(activeBook, true)}
      <div>
        <strong style="display:block;font-size:1.05rem;color:#1f2933">${escapeHtml(activeBook.title)}</strong>
        <span style="display:block;margin-top:4px">Chapitre ${chapterNumber}/${chapters.length}</span>
        <span style="display:block;margin-top:4px">Progression globale : ${progress} % (${status})</span>
        <span style="display:block;margin-top:4px">Temps restant estimé : ${formatMinutes(remainingMinutes())}</span>
      </div>
    </div>`;
}

function loadChapter(index, chunkIndex = 0) {
  if (!chapters[index]) return;
  stopReading(false);
  currentChapterIndex = index;
  chapterSelect.value = String(index);
  const text = chapters[index].text;
  chapterText.textContent = text || 'Aucun texte détecté dans ce chapitre.';
  chunks = splitText(text || '');
  currentChunkIndex = Math.min(chunkIndex, Math.max(chunks.length - 1, 0));
  persistPosition(); updateProgress(); renderBookInfo();
  setStatus(`Chapitre prêt : ${chapters[index].label}`);
}

function enableButtons(enabled) { [playBtn, pauseBtn, resumeBtn, stopBtn, prevBtn, nextBtn].forEach((button) => { button.disabled = !enabled; }); }

function updateProgress() {
  const chapterValue = chunks.length ? Math.round((currentChunkIndex / chunks.length) * 100) : 0;
  const globalValue = activeBook ? progressForBook(activeBook) : 0;
  progressBar.value = globalValue;
  progressText.textContent = `Livre : ${globalValue} % · Chapitre : ${chapterValue} % (${Math.min(currentChunkIndex + 1, Math.max(chunks.length, 1))}/${Math.max(chunks.length, 1)})`;
}

function speakCurrentChunk() {
  if (!chunks[currentChunkIndex]) { goNextChapter(true); return; }
  const utterance = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
  const selectedVoice = voices[Number(voiceSelect.value)];
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.rate = Number(rateRange.value || 1);
  utterance.lang = selectedVoice ? selectedVoice.lang : 'fr-FR';
  utterance.onend = () => {
    if (!isReading) return;
    currentChunkIndex += 1;
    persistPosition(); updateProgress(); renderBookInfo();
    if (currentChunkIndex < chunks.length) speakCurrentChunk();
    else goNextChapter(true);
  };
  utterance.onerror = (event) => { console.error(event); setStatus('Erreur pendant la lecture vocale. Essaie une autre voix ou relance la lecture.'); };
  speechSynthesis.speak(utterance);
  updateProgress(); renderBookInfo(); setStatus('Lecture en cours...');
}

function startReading() { if (!chunks.length) return; speechSynthesis.cancel(); isReading = true; speakCurrentChunk(); }
function stopReading(reset = false) { isReading = false; speechSynthesis.cancel(); if (reset) { currentChunkIndex = 0; persistPosition(); updateProgress(); renderBookInfo(); } }
function goNextChapter(auto = false) {
  if (currentChapterIndex + 1 < chapters.length) {
    const keepReading = auto && isReading;
    loadChapter(currentChapterIndex + 1, 0);
    if (keepReading) { isReading = true; startReading(); }
  } else { isReading = false; setStatus('Fin du livre.'); }
}
function goPreviousChapter() { if (currentChapterIndex > 0) loadChapter(currentChapterIndex - 1, 0); }

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.epub')) { setStatus('Choisis un fichier EPUB.'); return; }
  try { await addBook(file); }
  catch (error) { console.error(error); setStatus('Impossible de lire cet EPUB. Il peut être protégé par DRM, mal formé, ou ne pas contenir de texte exploitable.'); }
});
chapterSelect.addEventListener('change', (event) => loadChapter(Number(event.target.value), 0));
voiceSelect.addEventListener('change', (event) => localStorage.setItem('epubVoiceReader.voice', event.target.value));
rateRange.addEventListener('input', () => { rateValue.textContent = Number(rateRange.value).toFixed(1); renderBookInfo(); updateProgress(); });
rateRange.addEventListener('change', () => localStorage.setItem('epubVoiceReader.rate', rateRange.value));
playBtn.addEventListener('click', startReading);
pauseBtn.addEventListener('click', () => { speechSynthesis.pause(); setStatus('Lecture en pause.'); });
resumeBtn.addEventListener('click', () => { speechSynthesis.resume(); setStatus('Lecture reprise.'); });
stopBtn.addEventListener('click', () => { stopReading(false); setStatus('Lecture arrêtée. La position est conservée.'); });
nextBtn.addEventListener('click', () => goNextChapter(false));
prevBtn.addEventListener('click', goPreviousChapter);

const savedRate = localStorage.getItem('epubVoiceReader.rate');
if (savedRate) { rateRange.value = savedRate; rateValue.textContent = Number(savedRate).toFixed(1); }
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices(); loadBooks();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
