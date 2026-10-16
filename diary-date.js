// 以固定數字及大寫字高對齊日期與年月；月份下伸筆畫不影響日期字級。
(() => {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return;

  function measure(element, reference = element.dataset.dateText) {
    const style = getComputedStyle(element);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = context.measureText(reference);
    return {
      ascent: metrics.actualBoundingBoxAscent,
      height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    };
  }

  function prepare(element) {
    if (element.classList.contains('date-ink')) return;
    element.dataset.dateText = element.textContent.trim();
    const glyph = document.createElement('span');
    glyph.className = 'date-glyph';
    glyph.textContent = element.dataset.dateText;
    const baseline = document.createElement('span');
    baseline.className = 'date-baseline';
    baseline.setAttribute('aria-hidden', 'true');
    glyph.append(baseline);
    element.replaceChildren(glyph);
    element.classList.add('date-ink');
  }

  function trim(element, targetHeight, reference) {
    prepare(element);
    const metrics = measure(element, reference);
    const glyph = element.querySelector('.date-glyph');
    const baseline = element.querySelector('.date-baseline');
    // 兩個座標同時包含既有位移，相減後取得瀏覽器目前字型的實際基線。
    const currentScale = parseFloat(element.style.getPropertyValue('--date-ink-scale')) || 1;
    const baselineOffset = (baseline.getBoundingClientRect().top - glyph.getBoundingClientRect().top) / currentScale;
    const height = targetHeight || metrics.height;
    element.style.setProperty('--date-ink-height', `${height}px`);
    element.style.setProperty('--date-ink-offset', `${metrics.ascent - baselineOffset}px`);
    // 字型提示可能一次跳動 1–2px，補足最後的次像素差，避免不同日期仍有落差。
    element.style.setProperty('--date-ink-scale', height / metrics.height);
    return height;
  }

  function alignGroup(stack, year, month, days) {
    if (!stack || !year || !month || !days.length) return;
    const gap = parseFloat(getComputedStyle(stack).rowGap) || 0;
    // H 定義固定的大寫字高，g、p、y 等下伸筆畫仍正常顯示。
    const targetHeight = trim(year, undefined, '0123456789') + gap + trim(month, undefined, 'H');
    days.forEach(day => {
      prepare(day);
      // 每次從同一字級與同一組數字量測，避免月份或日期內容改變大小。
      day.style.setProperty('--date-day-font-size', '100px');
      // 先依字級接近目標高度，再由 trim 校正字型提示造成的餘差。
      for (let attempt = 0; attempt < 4; attempt++) {
        const height = measure(day, '0123456789').height;
        if (!height || Math.abs(height - targetHeight) < .1) break;
        const size = parseFloat(getComputedStyle(day).fontSize);
        day.style.setProperty('--date-day-font-size', `${size * targetHeight / height}px`);
      }
      trim(day, targetHeight, '0123456789');
    });
  }

  function alignDates() {
    document.querySelectorAll('.diary-month').forEach(section => {
      alignGroup(section.querySelector('.month-tag'), section.querySelector('.month-year'),
        section.querySelector('.month-name'), [...section.querySelectorAll('.row-day')]);
    });
    document.querySelectorAll('.diary-view-date').forEach(header => {
      alignGroup(header.querySelector('.diary-view-month'), header.querySelector('.diary-view-year'),
        header.querySelector('.diary-view-month-name'), [...header.querySelectorAll('.diary-view-day')]);
    });
  }

  let frame;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(alignDates);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 只觀察列表／文章容器的直接子元素，避免包裝字形時觸發自身。
    const observer = new MutationObserver(() => document.fonts.ready.then(schedule));
    ['diaryList', 'diaryView'].forEach(id => {
      const root = document.getElementById(id);
      if (root) observer.observe(root, { childList: true });
    });
    document.fonts.ready.then(schedule);
  });
  window.addEventListener('resize', schedule);
  document.fonts.addEventListener('loadingdone', schedule);
})();
