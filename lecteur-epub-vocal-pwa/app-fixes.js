function mediaFromPath(path) {
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

async function imageDataUrl(zip, path, mediaType) {
  const normalized = normalizePath(path);
  const file = zip.file(normalized);
  if (!file) return '';
  const base64 = await file.async('base64');
  return `data:${mediaType || mediaFromPath(normalized)};base64,${base64}`;
}

async function extractCover(zip, opfXml, basePath, manifest) {
  const items = Array.from(manifest.entries()).map(([id, item]) => ({ id, ...item }));

  const metaCover = localEls(opfXml, 'meta').find((meta) => meta.getAttribute('name') === 'cover');
  const coverId = metaCover ? metaCover.getAttribute('content') : '';
  if (coverId && manifest.get(coverId)) {
    const item = manifest.get(coverId);
    const result = await imageDataUrl(zip, basePath + item.href, item.media);
    if (result) return result;
  }

  const imageCandidates = items.filter((item) => /^image\//i.test(item.media));
  const namedCover = imageCandidates.find((item) => {
    const haystack = `${item.id || ''} ${item.href || ''} ${item.properties || ''}`.toLowerCase();
    return haystack.includes('cover') || haystack.includes('couverture') || haystack.includes('front');
  });
  if (namedCover) {
    const result = await imageDataUrl(zip, basePath + namedCover.href, namedCover.media);
    if (result) return result;
  }

  const spineItems = localEls(opfXml, 'itemref');
  for (const itemref of spineItems.slice(0, 5)) {
    const item = manifest.get(itemref.getAttribute('idref'));
    if (!item || !/xhtml|html/i.test(item.media)) continue;
    const htmlPath = normalizePath(basePath + item.href);
    const htmlFile = zip.file(htmlPath);
    if (!htmlFile) continue;
    const html = await htmlFile.async('text');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const img = doc.querySelector('img[src], image[href], image[xlink\\:href]');
    const src = img && (img.getAttribute('src') || img.getAttribute('href') || img.getAttribute('xlink:href'));
    if (!src || src.startsWith('data:')) continue;
    const candidatePath = normalizePath(dirname(htmlPath) + src.split('#')[0]);
    const result = await imageDataUrl(zip, candidatePath, mediaFromPath(candidatePath));
    if (result) return result;
  }

  if (imageCandidates.length === 1) {
    const only = imageCandidates[0];
    const result = await imageDataUrl(zip, basePath + only.href, only.media);
    if (result) return result;
  }

  return '';
}

function renderBookInfo() {
  if (!activeBook) {
    bookInfo.innerHTML = '';
    return;
  }
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
      </div>
    </div>`;
}

setTimeout(() => {
  try {
    if (typeof activeBook !== 'undefined' && activeBook) renderBookInfo();
  } catch (error) {
    console.warn(error);
  }
}, 100);
