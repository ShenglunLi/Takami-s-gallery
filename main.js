// main.js

// 確保 DOM 載入後再執行
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const fullMenu = document.getElementById('fullMenu');
    let lastScrollY = window.scrollY;

    // --- 導覽選單切換 ---
    window.toggleMenu = function() {
        if (!fullMenu || !menuBtn) return;
        const isActive = fullMenu.classList.toggle('active');
        
        if (isActive) {
            menuBtn.classList.add('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            menuBtn.classList.remove('hidden');
            document.body.style.overflow = '';
        }
    };

    // --- 捲動隱藏按鈕邏輯 ---
    window.addEventListener('scroll', () => {
        if (!menuBtn || (fullMenu && fullMenu.classList.contains('active'))) return;
        
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;

        if (delta > 0 && currentScrollY > 50) {
            menuBtn.classList.add('hidden');
        } else if (delta < 0) {
            menuBtn.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;
    });

    
    // --- 基礎內容保護 ---
        // 禁止右鍵
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 禁止複製與選取文字
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    // 禁止圖片拖拽
    document.addEventListener('dragstart', e => {
        if (e.target.tagName === 'IMG') e.preventDefault();
    });
});


// 鍵盤操作邏輯
document.addEventListener('keydown', function(event) {
    const overlay = document.getElementById('workOverlay');
    
    // 確保燈箱開啟中
    if (!overlay || !overlay.classList.contains('active')) return;

    // 檢查目前是否在 Viewer 層 (根據您 updateOverlayUI 的邏輯判斷)
    const isViewer = typeof isViewerActive !== 'undefined' && isViewerActive;

    if (isViewer) {
        /* --- Viewer Layer 操控邏輯 (同一作品換頁) --- */
        const item = currentFilteredWorks[currentIndex];
        if (!item || !item.img) return;

        switch (event.key) {
            case 'ArrowLeft':
                if (currentInnerIndex > 0) {
                    currentInnerIndex--;
                    updateViewerImage(); // 呼叫您提供的渲染函式
                }
                break;
            case 'ArrowRight':
                if (currentInnerIndex < item.img.length - 1) {
                    currentInnerIndex++;
                    updateViewerImage(); // 呼叫您提供的渲染函式
                }
                break;
            case 'Escape':
                if (typeof backToInfo === 'function') backToInfo();
                break;
        }
    } else {
        /* --- Info Layer 操控邏輯 (切換不同作品) --- */
        switch (event.key) {
            case 'ArrowLeft':
                // 觸發切換上一篇作品的邏輯
                if (typeof changeWork === 'function') changeWork(-1);
                break;
            case 'ArrowRight':
                // 觸發切換下一篇作品的邏輯
                if (typeof changeWork === 'function') changeWork(1);
                break;
            case 'Escape':
                if (typeof closeOverlay === 'function') closeOverlay();
                break;
        }
    }
});