const NEWS_URL = 'data/news.json';
const LOG_URL = 'data/log.json';

async function readJsonArray(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new TypeError(`${url}: 預期為 JSON 陣列`);
  return data;
}

function formatDate(date) {
  return typeof date === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/.test(date)
    ? date.replaceAll('-', ' / ')
    : '';
}

function localUrl(value, fallback) {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value, location.href);
    return url.origin === location.origin && /^https?:$/.test(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function renderNews(items) {
  const list = document.getElementById('news-list');
  list.replaceChildren();
  const latest = items.filter(item => item && formatDate(item.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (!latest.length) {
    const empty = document.createElement('li');
    empty.className = 'news-state';
    empty.textContent = 'No news yet.';
    list.append(empty);
    return;
  }

  for (const item of latest) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    const section = ['Gallery', 'Diary', 'Log'].includes(item.section) ? item.section : '';
    link.className = 'news-link';
    const destination = section === 'Gallery' && typeof item.id === 'string' && item.id
      ? `gallery.html?id=${encodeURIComponent(item.id)}`
      : item.url;
    link.href = localUrl(destination, '#');
    for (const [className, value] of [
      ['news-date', formatDate(item.date)],
      ['news-section', section ? `【${section}】` : ''],
      ['news-text', typeof item.text === 'string' ? item.text : '更新']
    ]) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = value;
      link.append(span);
    }
    row.append(link);
    list.append(row);
  }
}

async function loadNews() {
  try {
    renderNews(await readJsonArray(NEWS_URL));
  } catch (error) {
    console.error('News 載入失敗:', error);
    const list = document.getElementById('news-list');
    const row = document.createElement('li');
    row.className = 'news-state';
    row.textContent = 'Unable to load news.';
    list.replaceChildren(row);
  }
}

async function loadLogPreview() {
  const target = document.getElementById('log-latest');
  try {
    const logs = await readJsonArray(LOG_URL);
    const latest = logs.filter(item => item && formatDate(item.date))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return;
    const title = typeof latest.title === 'string' ? latest.title.trim() : '';
    target.textContent = `${formatDate(latest.date)} ${title || '最新の記録'}`;
  } catch (error) {
    // log.json 建立前維持「公開準備中」，其餘錯誤可從主控台確認。
    if (!(error instanceof Error && error.message.includes('HTTP 404'))) {
      console.error('Log 載入失敗:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadNews();
  loadLogPreview();
});
