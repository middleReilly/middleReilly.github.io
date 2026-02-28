/* ==========================================================
   INTERESTS.JS — Auto-carousel for Current Interests
   ==========================================================
   Fetches books and music from the Supabase 'interests' table
   and displays them as a crossfade carousel on the About page.

   Managed via the Admin dashboard Interests tab.
*/

let interestItems = [];
let currentIndex  = 0;
let carouselTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  renderInterestsCarousel();
});


/* ==========================================================
   Fetch & Render
   ========================================================== */

async function renderInterestsCarousel() {
  const container = document.getElementById('interests-carousel');
  if (!container) return;

  // Show skeleton while loading
  container.innerHTML = `
    <div class="carousel-skeleton">
      <div class="skeleton" style="width:160px; height:160px; border-radius:8px;"></div>
      <div class="skeleton skeleton-title" style="margin-top:var(--space-sm);"></div>
      <div class="skeleton skeleton-text"></div>
    </div>`;

  try {
    const { data, error } = await db
      .from('interests')
      .select('id, title, creator, category, cover_url, display_order')
      .eq('published', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <p style="text-align:center; color:var(--sage);">
          Nothing here yet — check back soon.
        </p>`;
      return;
    }

    interestItems = data;
    currentIndex  = 0;

    // Build the carousel DOM (inline styles as fallback in case stylesheet fails)
    container.innerHTML = `
      <div class="carousel-viewport"
           style="position:relative; min-height:240px; overflow:hidden;">
        <div class="carousel-slide active" id="carousel-slide-a"
             style="position:absolute; top:0; left:0; right:0; bottom:0;
                    display:flex; align-items:center; justify-content:center; gap:2rem;
                    transition:opacity 0.6s ease;"></div>
        <div class="carousel-slide" id="carousel-slide-b"
             style="position:absolute; top:0; left:0; right:0; bottom:0;
                    display:flex; align-items:center; justify-content:center; gap:2rem;
                    opacity:0; transition:opacity 0.6s ease; pointer-events:none;"></div>
      </div>
      <div class="carousel-controls"
           style="display:flex; align-items:center; justify-content:center; gap:1rem; margin-top:1.5rem;">
        <button class="carousel-btn" id="carousel-prev" aria-label="Previous">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="carousel-dots" id="carousel-dots"></div>
        <button class="carousel-btn" id="carousel-next" aria-label="Next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    `;

    // Render dots
    renderDots();

    // Show the first item immediately
    fillSlide('carousel-slide-a', interestItems[0]);

    // Wire up prev/next
    document.getElementById('carousel-prev').addEventListener('click', () => {
      goTo((currentIndex - 1 + interestItems.length) % interestItems.length);
    });
    document.getElementById('carousel-next').addEventListener('click', () => {
      goTo((currentIndex + 1) % interestItems.length);
    });

    // Start auto-rotation (5 seconds)
    startAutoPlay();

    // Pause on hover
    container.addEventListener('mouseenter', stopAutoPlay);
    container.addEventListener('mouseleave', startAutoPlay);

  } catch (err) {
    console.error('Error loading interests:', err);
    container.innerHTML = `
      <p style="color:var(--sage); text-align:center;">
        Unable to load current interests.
      </p>`;
  }
}


/* ==========================================================
   Carousel Logic
   ========================================================== */

function fillSlide(slideId, item) {
  const slide = document.getElementById(slideId);
  if (!slide || !item) return;

  const categoryIcon = item.category === 'book'
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">
         <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
         <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
       </svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">
         <path d="M9 18V5l12-2v13"/>
         <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
       </svg>`;

  const safeTitle   = escapeInterest(item.title);
  const safeCreator = escapeInterest(item.creator);
  const safeCover   = escapeInterest(item.cover_url);
  const safeCategory = escapeInterest(item.category);

  slide.innerHTML = `
    <div class="carousel-cover"
         style="width:180px; height:180px; border-radius:8px; overflow:hidden; flex-shrink:0;">
      <img src="${safeCover}" alt="${safeTitle}" loading="lazy"
           style="width:100%; height:100%; object-fit:cover; display:block;"
           onerror="this.parentElement.classList.add('cover-error')">
    </div>
    <div class="carousel-info" style="max-width:320px;">
      <span class="carousel-category">
        ${categoryIcon} ${safeCategory}
      </span>
      <p class="carousel-title">${safeTitle}</p>
      <p class="carousel-creator">${safeCreator}</p>
    </div>
  `;
}

function goTo(newIndex) {
  if (newIndex === currentIndex || interestItems.length <= 1) return;

  const slideA = document.getElementById('carousel-slide-a');
  const slideB = document.getElementById('carousel-slide-b');

  // Determine which slide is currently visible
  const isAActive = slideA.classList.contains('active');
  const incoming  = isAActive ? slideB : slideA;
  const outgoing  = isAActive ? slideA : slideB;

  // Fill the incoming slide with the new item
  fillSlide(incoming.id, interestItems[newIndex]);

  // Crossfade — toggle class AND inline styles for resilience
  incoming.classList.add('active');
  incoming.style.opacity = '1';
  incoming.style.pointerEvents = 'auto';

  outgoing.classList.remove('active');
  outgoing.style.opacity = '0';
  outgoing.style.pointerEvents = 'none';

  currentIndex = newIndex;
  updateDots();
}

function renderDots() {
  const dotsContainer = document.getElementById('carousel-dots');
  if (!dotsContainer) return;
  dotsContainer.innerHTML = interestItems.map((_, i) =>
    `<button class="carousel-dot ${i === 0 ? 'active' : ''}"
             data-index="${i}" aria-label="Go to item ${i + 1}"></button>`
  ).join('');

  dotsContainer.addEventListener('click', (e) => {
    const dot = e.target.closest('.carousel-dot');
    if (!dot) return;
    goTo(parseInt(dot.dataset.index, 10));
    stopAutoPlay();
    startAutoPlay();
  });
}

function updateDots() {
  document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });
}

function startAutoPlay() {
  stopAutoPlay();
  if (interestItems.length <= 1) return;
  carouselTimer = setInterval(() => {
    goTo((currentIndex + 1) % interestItems.length);
  }, 5000);
}

function stopAutoPlay() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}


/* ==========================================================
   Helper
   ========================================================== */

function escapeInterest(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
