const LOG_DATA_URL = 'data/log.json';
let logEntries = [];
let activeLogIndex = -1;
let previousFocus = null;
let previousOverflow = '';

function logImageUrl(filename) {
  if (typeof filename !== 'string' || !/^[^\\/]+\.(?:jpe?g|png|webp|gif)$/i.test(filename)) return '';
  return `img/log/${encodeURIComponent(filename)}`;
}

function logDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.replaceAll('-', ' / ')
    : '';
}

function renderLog(entries) {
  const grid = document.getElementById('log-list');
  grid.replaceChildren();
  logEntries = entries.filter(entry => entry && logDate(entry.date) && logImageUrl(entry.img))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!logEntries.length) {
    const status = document.createElement('p');
    status.className = 'log-status';
    status.textContent = '現在、Log の記録はありません。';
    grid.append(status);
    return;
  }

  logEntries.forEach((entry, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'log-card';
    card.setAttribute('aria-label', `${logDate(entry.date)} ${entry.location1 || ''} ${entry.location2 || ''} の写真を開く`);

    const image = document.createElement('img');
    image.className = 'log-card-image';
    image.src = logImageUrl(entry.img);
    image.alt = [entry.location1, entry.location2].filter(Boolean).join(' ');
    image.loading = 'lazy';

    const copy = document.createElement('span');
    copy.className = 'log-card-copy';
    for (const value of [logDate(entry.date), entry.location1, entry.location2]) {
      const line = document.createElement('span');
      line.textContent = typeof value === 'string' ? value : '';
      copy.append(line);
    }

    card.append(image, copy);
    card.addEventListener('click', () => openLog(index));
    grid.append(card);
  });

  const linkedId = new URLSearchParams(window.location.search).get('id');
  if (linkedId) {
    const index = logEntries.findIndex(entry => entry.id === linkedId);
    if (index !== -1) openLog(index);
  }
}

function showLog(index) {
  const entry = logEntries[index];
  if (!entry) return;
  activeLogIndex = index;
  const image = document.getElementById('log-full-image');
  image.src = logImageUrl(entry.img);
  image.alt = [entry.location1, entry.location2].filter(Boolean).join(' ');
  document.getElementById('log-date').textContent = logDate(entry.date);
  document.getElementById('log-location1').textContent = entry.location1 || '';
  document.getElementById('log-location2').textContent = entry.location2 || '';
  document.getElementById('log-prev').disabled = index === 0;
  document.getElementById('log-next').disabled = index === logEntries.length - 1;
}

function openLog(index) {
  if (!logEntries[index]) return;
  const overlay = document.getElementById('log-overlay');
  if (overlay.hidden) {
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlay.hidden = false;
    document.getElementById('log-close').focus();
  }
  showLog(index);
}

function closeLog() {
  const overlay = document.getElementById('log-overlay');
  if (overlay.hidden) return;
  overlay.hidden = true;
  document.body.style.overflow = previousOverflow;
  document.getElementById('log-full-image').removeAttribute('src');
  activeLogIndex = -1;
  if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
}

async function initLog() {
  const grid = document.getElementById('log-list');
  try {
    const response = await fetch(LOG_DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new TypeError('log.json 應為陣列');
    renderLog(entries);
  } catch (error) {
    console.error('Log 資料載入失敗:', error);
    const status = document.createElement('p');
    status.className = 'log-status';
    status.textContent = '無法載入 Log，請稍後再試。';
    grid.replaceChildren(status);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('log-close').addEventListener('click', closeLog);
  document.getElementById('log-prev').addEventListener('click', () => showLog(activeLogIndex - 1));
  document.getElementById('log-next').addEventListener('click', () => showLog(activeLogIndex + 1));
  document.getElementById('log-overlay').addEventListener('click', event => {
    if (event.target.id === 'log-overlay') closeLog();
  });
  document.addEventListener('keydown', event => {
    if (document.getElementById('log-overlay').hidden) return;
    if (event.key === 'Escape') closeLog();
    if (event.key === 'ArrowLeft') showLog(activeLogIndex - 1);
    if (event.key === 'ArrowRight') showLog(activeLogIndex + 1);
  });
  initLog();
});
