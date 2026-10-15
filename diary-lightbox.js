// 沿用 Gallery 的燈箱視覺，僅在目前 Diary 文章的圖片間切換。
function createDiaryLightbox(paths, title, onChange) {
  const dialog = document.getElementById('diaryLightbox');
  const image = document.getElementById('diaryLightboxImage');
  const stage = document.getElementById('diaryLightboxStage');
  const previous = document.getElementById('diaryLightboxPrev');
  const next = document.getElementById('diaryLightboxNext');
  const close = document.getElementById('diaryLightboxClose');
  const indicator = document.getElementById('diaryLightboxIndicator');
  const status = document.getElementById('diaryLightboxStatus');
  let index = 0;
  let returnFocus;
  let previousOverflow;
  let scale = 1, x = 0, y = 0;
  let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
  let pinchDistance = 0, pinchScale = 1;
  let hadPinch = false, moved = false;
  let startedOnImage = false;
  const pointers = new Map();

  function transform() {
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    image.style.cursor = scale > 1 ? 'grab' : 'pointer';
  }

  function resetZoom() {
    scale = 1; x = 0; y = 0;
    transform();
  }

  function select(targetIndex) {
    if (targetIndex < 0 || targetIndex >= paths.length) return;
    index = targetIndex;
    resetZoom();
    image.src = paths[index];
    image.alt = `${title}（第 ${index + 1} 張）`;
    previous.disabled = index === 0;
    next.disabled = index === paths.length - 1;
    previous.classList.toggle('btn-hidden', previous.disabled);
    next.classList.toggle('btn-hidden', next.disabled);
    // 換頁後將焦點留在可操作的控制項，避免焦點停在隱藏箭頭。
    if (dialog.open && document.activeElement.disabled) close.focus();
    indicator.replaceChildren(...paths.map((_, dotIndex) => {
      const dot = document.createElement('span');
      dot.className = `dot${dotIndex === index ? ' active' : ''}`;
      return dot;
    }));
    indicator.hidden = paths.length === 1;
    status.textContent = `第 ${index + 1} 張，共 ${paths.length} 張圖片`;
    onChange(index);
  }

  function open() {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    pointers.clear();
    moved = false;
    select(index);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    close.focus();
  }

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    pointers.clear();
    resetZoom();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (!moved && (event.target === dialog || (event.target === stage && !startedOnImage) || event.target.classList.contains('overlay-content'))) dialog.close();
    moved = false;
  });
  previous.addEventListener('click', () => select(index - 1));
  next.addEventListener('click', () => select(index + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      select(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  stage.addEventListener('dblclick', event => {
    if (event.target !== image && !startedOnImage) return;
    scale = scale === 1 ? 2 : 1;
    x = 0; y = 0;
    transform();
  });

  function distance() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  stage.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      startedOnImage = event.target === image;
      startX = event.clientX; startY = event.clientY;
      startPanX = x; startPanY = y;
      hadPinch = false; moved = false;
    } else if (pointers.size === 2) {
      hadPinch = true;
      pinchDistance = distance(); pinchScale = scale;
    }
  });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
    if (pointers.size === 2 && pinchDistance) {
      scale = Math.min(3, Math.max(1, pinchScale * distance() / pinchDistance));
      if (scale === 1) { x = 0; y = 0; }
      transform();
    } else if (pointers.size === 1 && scale > 1) {
      x = startPanX + dx; y = startPanY + dy;
      transform();
    }
  });
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (event.type === 'pointerup' && !hadPinch && scale === 1 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) select(index + (dx < 0 ? 1 : -1));
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      startX = remaining.x; startY = remaining.y;
      startPanX = x; startPanY = y;
    }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  return { open, select };
}
