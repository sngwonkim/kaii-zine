/* =============================================
   Kaii Zine — app.js
   ============================================= */

// ===== CONFIG =====
const PAGES_DIR   = 'chongqingbike_jpg/';
const TOTAL_PAGES = 24;

function pageUrl(n) { return `${PAGES_DIR}${n}.jpg`; }

// ===== MOCK COMMENTS (per page, 1-based) =====
const SEED_COMMENTS = {
  1: [
    { text: 'kkkk',      name: 'sngwon',   x: 12, y: 38 },
    { text: 'cute',      name: 'seouhyun', x: 74, y: 22 },
  ],
  2: [
    { text: '오 좋다',   name: 'j',        x: 20, y: 55 },
  ],
  4: [
    { text: '너무 좋아', name: 'hyunjin',  x: 62, y: 42 },
  ],
};

// ===== STATE =====
let currentPage  = 1;
let isAnimating  = false;
let activeCard   = 0;
let flipInstance = null;

const liveComments = JSON.parse(JSON.stringify(SEED_COMMENTS));

// ===== DOM =====
const $ = (id) => document.getElementById(id);

const noticeOverlay     = $('notice-overlay');
const noticeBtnClose    = $('notice-close');
const logo              = $('logo');
const siteHeader        = $('site-header');
const galleryView       = $('gallery-view');
const readerView        = $('reader-view');
const card0             = $('card-0');
const card1             = $('card-1');
const btnPrevCard       = $('btn-prev-card');
const btnNextCard       = $('btn-next-card');
const coverCanvas       = $('cover-canvas');
const coverLoading      = $('cover-loading');
const thumb0            = $('thumb-0');
const upcomingFront     = document.querySelector('.upcoming-front');
const upcomingBack      = document.querySelector('.upcoming-back');
const emailInput        = $('email-input');
const emailSend         = $('email-send');
const emailThanks       = $('email-thanks');
const floatLayer        = $('float-layer');
const btnPrevPage       = $('btn-prev-page');
const btnNextPage       = $('btn-next-page');
const flipBookEl        = $('flip-book');
const readerLogo        = $('reader-logo');
const pageCount         = $('page-count');
const commentBtn        = $('comment-btn');
const commentPanel      = $('comment-panel');
const commentPanelClose = $('comment-panel-close');
const cName             = $('c-name');
const cText             = $('c-text');
const cSubmit           = $('c-submit');
const backBtn           = $('back-btn');


// ===== INIT =====
(function init() {
  if (!localStorage.getItem('kaii_seen')) {
    localStorage.setItem('kaii_seen', '1');
  } else {
    noticeOverlay.classList.add('hidden');
  }

  // Draw cover thumbnail from 1.jpg
  const img = new Image();
  img.onload = () => {
    const dpr   = window.devicePixelRatio || 1;
    const scale = Math.min(500 / img.naturalWidth, 350 / img.naturalHeight);
    const w     = Math.floor(img.naturalWidth  * scale);
    const h     = Math.floor(img.naturalHeight * scale);
    coverCanvas.width        = w * dpr;
    coverCanvas.height       = h * dpr;
    coverCanvas.style.width  = w + 'px';
    coverCanvas.style.height = h + 'px';
    const ctx = coverCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.drawImage(img, 0, 0, w, h);
    coverLoading.classList.add('hidden');
  };
  img.onerror = () => { coverLoading.textContent = '이미지 로드 실패'; };
  img.src = pageUrl(1);
})();


// ===== NOTICE =====
noticeBtnClose.addEventListener('click', () => noticeOverlay.classList.add('hidden'));
noticeOverlay.addEventListener('click', (e) => {
  if (e.target === noticeOverlay) noticeOverlay.classList.add('hidden');
});
logo.addEventListener('click', () => noticeOverlay.classList.remove('hidden'));


// ===== GALLERY NAV (lazy Susan) =====
function cardEl(idx) { return idx === 0 ? card0 : card1; }

async function switchCard(dir) {
  if (isAnimating) return;
  const next = (activeCard + dir + 2) % 2;
  if (next === activeCard) return;

  isAnimating = true;
  const from = cardEl(activeCard);
  const to   = cardEl(next);

  from.classList.remove('active');
  from.style.pointerEvents = 'none';
  from.classList.add(dir > 0 ? 'anim-out' : 'anim-out-rev');

  await delay(130);

  to.style.opacity = '0';
  to.style.pointerEvents = 'none';
  to.classList.add(dir > 0 ? 'anim-in' : 'anim-in-rev');

  await delay(500);

  from.classList.remove('anim-out', 'anim-out-rev');
  from.style.pointerEvents = '';

  to.classList.remove('anim-in', 'anim-in-rev');
  to.style.opacity = '';
  to.style.pointerEvents = '';
  to.classList.add('active');

  activeCard  = next;
  isAnimating = false;
}

btnPrevCard.addEventListener('click', () => switchCard(-1));
btnNextCard.addEventListener('click', () => switchCard(1));


// ===== OPEN READER =====
thumb0.addEventListener('click', openReader);

// Image native ratio: 1190x840
const IMG_W = 1190, IMG_H = 840;

function calcFlipSize() {
  const availW = window.innerWidth  - 180; // room for nav buttons
  const availH = window.innerHeight - 160; // room for header + bottom controls
  const ratio  = IMG_W / IMG_H;
  let w = availW, h = availW / ratio;
  if (h > availH) { h = availH; w = h * ratio; }
  return { width: Math.round(w), height: Math.round(h) };
}

function openReader() {
  readerLogo.textContent = 'chongqing bike (2026)';
  siteHeader.classList.add('hidden');
  galleryView.classList.add('hidden');
  readerView.classList.remove('hidden');

  if (flipInstance) {
    try { flipInstance.destroy(); } catch (_) {}
    flipInstance = null;
  }

  // Must clear before StPageFlip init — the #flip-loading div has inset:0 background and would cover everything
  flipBookEl.innerHTML = '';

  const { width, height } = calcFlipSize();
  flipBookEl.style.width  = width  + 'px';
  flipBookEl.style.height = height + 'px';

  // Pass JPG URLs directly — no rendering, browser downloads in parallel
  const imageUrls = Array.from({ length: TOTAL_PAGES }, (_, i) => pageUrl(i + 1));

  flipInstance = new St.PageFlip(flipBookEl, {
    width,
    height,
    size: 'fixed',
    usePortrait: true,
    showCover: false,
    autoSize: false,
    drawShadow: false,
    animationDuration: 600,
    mobileScrollSupport: false,
    swipeDistance: 30,
    useMouseEvents: true,
  });

  flipInstance.loadFromImages(imageUrls);

  flipInstance.on('flip', (e) => {
    currentPage = e.data + 1;
    updatePageCount();
    renderFloatingComments(currentPage);
  });

  currentPage = 1;
  updatePageCount();
  renderFloatingComments(1);
}

backBtn.addEventListener('click', () => {
  readerView.classList.add('hidden');
  galleryView.classList.remove('hidden');
  siteHeader.classList.remove('hidden');
  readerLogo.textContent = '';
  floatLayer.innerHTML   = '';
  commentPanel.classList.add('hidden');
  if (flipInstance) {
    try { flipInstance.destroy(); } catch (_) {}
    flipInstance = null;
    flipBookEl.innerHTML = '<div id="flip-loading">loading...</div>';
  }
});

function updatePageCount() {
  pageCount.textContent = `${currentPage} / ${TOTAL_PAGES}`;
}


// ===== PAGE NAV =====
function goToPage(target) {
  if (!flipInstance) return;
  if (target < 1 || target > TOTAL_PAGES) return;
  if (target > currentPage)      flipInstance.flipNext();
  else if (target < currentPage) flipInstance.flipPrev();
}

btnPrevPage.addEventListener('click', () => goToPage(currentPage - 1));
btnNextPage.addEventListener('click', () => goToPage(currentPage + 1));


// ===== KEYBOARD =====
document.addEventListener('keydown', (e) => {
  if (!readerView.classList.contains('hidden')) {
    if (e.key === 'ArrowRight') goToPage(currentPage + 1);
    if (e.key === 'ArrowLeft')  goToPage(currentPage - 1);
    if (e.key === 'Escape')     backBtn.click();
  } else if (!galleryView.classList.contains('hidden')) {
    if (e.key === 'ArrowRight') switchCard(1);
    if (e.key === 'ArrowLeft')  switchCard(-1);
  }
});


// ===== FLOATING COMMENTS =====
function renderFloatingComments(pageNum) {
  floatLayer.innerHTML = '';
  const list = liveComments[pageNum] || [];
  list.forEach((c, i) => {
    const el = document.createElement('div');
    el.className   = 'float-comment';
    el.textContent = `${c.text}  -${c.name}`;
    el.style.left  = `${c.x}%`;
    el.style.top   = `${c.y}%`;
    el.style.setProperty('--dur',   `${6 + i * 1.3}s`);
    el.style.setProperty('--delay', `${i * 1.1}s`);
    floatLayer.appendChild(el);
  });
}

function pushComment(pageNum, text, name) {
  if (!liveComments[pageNum]) liveComments[pageNum] = [];
  liveComments[pageNum].push({
    text,
    name,
    x: 8 + Math.random() * 76,
    y: 8 + Math.random() * 76,
  });
  // TODO: Firebase write
}


// ===== COMMENT PANEL =====
commentBtn.addEventListener('click', () => commentPanel.classList.toggle('hidden'));
commentPanelClose.addEventListener('click', () => commentPanel.classList.add('hidden'));

cSubmit.addEventListener('click', () => {
  const text = cText.value.trim();
  if (!text) return;
  const name = cName.value.trim() || 'anon';
  pushComment(currentPage, text, name);
  renderFloatingComments(currentPage);
  cName.value = '';
  cText.value = '';
  commentPanel.classList.add('hidden');
});


// ===== UPCOMING / EMAIL =====
upcomingFront.addEventListener('click', () => {
  upcomingFront.classList.add('hidden');
  upcomingBack.classList.remove('hidden');
});

emailSend.addEventListener('click', () => {
  const val = emailInput.value.trim();
  if (!val || !val.includes('@')) {
    emailInput.style.borderBottomColor = 'red';
    return;
  }
  emailInput.style.borderBottomColor = '';

  // TODO: EmailJS send

  emailInput.value = '';
  document.querySelector('.email-row').classList.add('hidden');
  emailThanks.classList.remove('hidden');
});


// ===== UTIL =====
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
