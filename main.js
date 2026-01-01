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