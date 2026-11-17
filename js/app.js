/* =====================================================================
   STEP TECH — APP LOGIC
   Router + state + rendering + auth/cart/favorites/filter ლოგიკა.
   app.js არის ერთადერთი <script type="module">, დანარჩენი ყველაფერი
   აქედან შემოაქვს import-ით (ლექტორის მოდულური სტრუქტურის მიხედვით).
===================================================================== */
import { Auth, extractErrorMessage } from "./config/http.js";
import { AuthAPI, extractTokenAndUser } from "./auth/auth.js";
import { CategoriesAPI } from "./categories/categories.js";
import { ProductsAPI } from "./products/products.js";
import { CartAPI } from "./cart/cart.js";
import { FavoritesAPI } from "./favorites/favorites.js";
import { UsersAPI } from "./users/users.js";
import { ReviewsAPI } from "./reviews/reviews.js";

const state = {
  categories: [],
  products: [],
  cart: [],
  favoriteIds: new Set(),
  filters: {
    category: null,
    minRating: 0,
    priceMin: null,
    priceMax: null,
    brand: '',
    inStock: false,
    search: '',
    sort: 'default'
  },
  shopPage: 1,
  pageSize: 8,
  cartLoaded: false,
  favoritesLoaded: false
};

/* ---------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------- */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function formatPrice(n) {
  const num = Number(n) || 0;
  return `USD ${num.toLocaleString('en-US')}`;
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function isRealImage(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}
function placeholderImage(seedText, categoryName) {
  const palette = ['#16a34a', '#0ea5e9', '#f97316', '#8b5cf6', '#ef4444', '#0f766e', '#eab308', '#64748b'];
  let hash = 0;
  const s = (seedText || categoryName || 'x');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const color = palette[hash % palette.length];
  const initials = (categoryName || seedText || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="120" fill="white" fill-opacity="0.9" text-anchor="middle" dominant-baseline="central">${escapeHtml(initials)}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function productImageUrl(p) {
  if (isRealImage(p.imageUrl)) return p.imageUrl;
  return placeholderImage(p.name, p.category && p.category.name);
}
function categoryImageUrl(c) {
  if (isRealImage(c.imageUrl)) return c.imageUrl;
  return placeholderImage(c.name, c.name);
}
function starsHtml(rating) {
  const r = Math.round(Number(rating) || 0);
  let out = '<span class="stars">';
  for (let i = 1; i <= 5; i++) out += `<span class="${i <= r ? 'filled' : ''}">★</span>`;
  out += '</span>';
  return out;
}
function isNewProduct(p) {
  if (!p.createdAt) return false;
  const days = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 21;
}

/* ---------------------------------------------------------------------
   Toasts
--------------------------------------------------------------------- */
function toast(message, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 250); }, 3200);
}

/* ---------------------------------------------------------------------
   Router
--------------------------------------------------------------------- */
function parseHash() {
  let hash = location.hash || '#/';
  hash = hash.slice(1);
  const [path, queryString] = hash.split('?');
  return { path: path || '/', params: new URLSearchParams(queryString || '') };
}

function hideAllViews() { $all('.view').forEach(v => v.hidden = true); }

function updateActiveNav(path) {
  $all('.nav-link[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === (path === '/' ? 'home' : path.replace('/', '')));
  });
}

async function router() {
  const { path, params } = parseHash();
  hideAllViews();
  closeMobileNav();
  closeAllDropdowns();
  window.scrollTo(0, 0);
  updateActiveNav(path);

  if (path === '/shop') {
    $('#view-shop').hidden = false;
    applyParamsToFilters(params);
    renderShop();
  } else if (path.startsWith('/product/')) {
    $('#view-product').hidden = false;
    const id = Number(path.split('/')[2]);
    await renderProductDetail(id);
  } else if (path === '/favorites') {
    $('#view-favorites').hidden = false;
    await renderFavoritesView();
  } else if (['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(path)) {
    $('#view-auth').hidden = false;
    renderAuthForm(path, params);
  } else {
    $('#view-home').hidden = false;
    renderHome();
  }
}

function applyParamsToFilters(params) {
  state.filters.category = params.get('category') || null;
  state.filters.search = params.get('search') || '';
  const sortParam = params.get('sort');
  state.filters.sort = sortParam || state.filters.sort || 'default';
  if (sortParam === 'newest') state.filters.sort = 'newest';
  state.shopPage = 1;
}

/* ---------------------------------------------------------------------
   Header: nav category dropdown, auth area, mobile menu
--------------------------------------------------------------------- */
function categoryLinksHtml() {
  return state.categories.map(c =>
    `<a href="#/shop?category=${encodeURIComponent(c.name)}" data-link>${escapeHtml(c.name)} <span class="count">${c.productCount ?? ''}</span></a>`
  ).join('');
}

function renderCategoryDropdown() {
  const html = categoryLinksHtml();
  $('#category-dropdown').innerHTML = html;
  const mobileList = $('#mobile-category-list');
  if (mobileList) mobileList.innerHTML = html;
}

function closeAllDropdowns() {
  $all('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
  $all('.auth-menu-wrap.open').forEach(d => d.classList.remove('open'));
}

function renderHeaderAuthArea() {
  const area = $('#auth-area');
  const user = Auth.getUser();
  const loggedIn = Auth.isLoggedIn();

  $('#cart-toggle-btn').hidden = !loggedIn;
  $('#favorites-toggle-btn').hidden = !loggedIn;

  if (!loggedIn) {
    area.innerHTML = `<a href="#/login" data-link class="btn btn-primary btn-sm">Sign In</a>`;
    return;
  }

  const first = (user && user.firstName) || '';
  const last = (user && user.lastName) || '';
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || (user && user.email ? user.email[0].toUpperCase() : 'U');
  const fullName = [first, last].filter(Boolean).join(' ') || (user && user.email) || 'მომხმარებელი';

  area.innerHTML = `
    <div class="auth-menu-wrap" id="auth-menu-wrap">
      <button type="button" class="auth-avatar-btn" id="auth-avatar-btn">${escapeHtml(initials)}</button>
      <div class="auth-dropdown-menu">
        <div class="auth-user-name">${escapeHtml(fullName)}</div>
        <a href="#/favorites" data-link>ჩემი ფავორიტები</a>
        <button type="button" id="logout-btn" class="danger">გასვლა</button>
      </div>
    </div>`;

  $('#auth-avatar-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#auth-menu-wrap').classList.toggle('open');
  });
  $('#logout-btn').addEventListener('click', handleLogout);
}

function handleLogout() {
  Auth.logout();
  state.cart = [];
  state.favoriteIds = new Set();
  state.cartLoaded = false;
  state.favoritesLoaded = false;
  updateCartBadge();
  updateFavoritesBadge();
  renderHeaderAuthArea();
  toast('წარმატებით გახვედით სისტემიდან', 'success');
  location.hash = '#/';
}

function toggleMobileNav() {
  const nav = $('#mobile-nav');
  nav.hidden = !nav.hidden;
}
function closeMobileNav() { $('#mobile-nav').hidden = true; }

/* ---------------------------------------------------------------------
   Product Card (shared between Home / Shop / Favorites)
--------------------------------------------------------------------- */
function renderProductCard(p) {
  const soldOut = (p.stock ?? 0) <= 0;
  const isFav = state.favoriteIds.has(p.id);
  const catName = p.category && p.category.name ? p.category.name : '';
  const badge = soldOut
    ? `<span class="product-badge sold-out">Sold Out</span>`
    : (isNewProduct(p) ? `<span class="product-badge">New</span>` : '');

  return `
  <div class="product-card" data-product-id="${p.id}">
    <a href="#/product/${p.id}" data-link style="display:block">
      <div class="product-thumb">
        <img src="${productImageUrl(p)}" alt="${escapeHtml(p.name)}" loading="lazy"
             onerror="this.onerror=null;this.src='${placeholderImage(p.name, catName)}'">
        ${badge}
      </div>
    </a>
    <button type="button" class="product-fav-btn ${isFav ? 'active' : ''}" data-fav-id="${p.id}" aria-label="Toggle favorite">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}"><path d="M12 20s-7-4.35-9.5-8.8C.9 8.1 2.2 4.5 5.6 4c2-.3 3.7.7 4.9 2.3l1.5 2 1.5-2C14.7 4.7 16.4 3.7 18.4 4c3.4.5 4.7 4.1 3.1 7.2C19 15.65 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </button>
    <div class="product-body">
      <div class="product-meta">
        <span class="cat">${escapeHtml(catName)}</span>
        ${p.brand ? `<span class="brand">${escapeHtml(p.brand)}</span>` : ''}
      </div>
      <a href="#/product/${p.id}" data-link style="color:inherit">
        <h4 class="product-name">${escapeHtml(p.name)}</h4>
      </a>
      <div class="product-rating">${starsHtml(p.rating)} <span>${(Number(p.rating) || 0).toFixed(1)}</span></div>
      <div class="product-price">${formatPrice(p.price)}</div>
      <button type="button" class="btn ${soldOut ? 'btn-outline' : 'btn-primary'} btn-block product-add-btn"
        data-add-id="${p.id}" ${soldOut ? 'disabled' : ''}>
        ${soldOut ? 'Out of Stock' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="margin-right:4px"><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Add to Cart'}
      </button>
    </div>
  </div>`;
}

function bindProductGridEvents(container) {
  $all('[data-add-id]', container).forEach(btn => {
    btn.addEventListener('click', () => handleAddToCart(Number(btn.dataset.addId)));
  });
  $all('[data-fav-id]', container).forEach(btn => {
    btn.addEventListener('click', () => handleToggleFavorite(Number(btn.dataset.favId)));
  });
}

/* ---------------------------------------------------------------------
   HOME VIEW
--------------------------------------------------------------------- */
function renderHome() {
  const catGrid = $('#home-category-grid');
  catGrid.innerHTML = state.categories.map(c => `
    <a href="#/shop?category=${encodeURIComponent(c.name)}" data-link class="category-card">
      <div class="category-card-thumb">
        <img src="${categoryImageUrl(c)}" alt="${escapeHtml(c.name)}"
             onerror="this.onerror=null;this.src='${placeholderImage(c.name, c.name)}'">
      </div>
      <div class="category-card-info">
        <h4>${escapeHtml(c.name)}</h4>
        <span>${c.productCount ?? 0} products</span>
      </div>
      <span class="category-card-arrow">›</span>
    </a>`).join('') || '<p class="muted">კატეგორიები ვერ ჩაიტვირთა.</p>';

  const featured = [...state.products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
  const featGrid = $('#featured-products-grid');
  featGrid.innerHTML = featured.map(renderProductCard).join('') || '<p class="muted">პროდუქტები ვერ ჩაიტვირთა.</p>';
  bindProductGridEvents(featGrid);

  const newest = [...state.products]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 4);
  const newGrid = $('#new-arrivals-grid');
  newGrid.innerHTML = newest.map(renderProductCard).join('') || '<p class="muted">არაფერია დამატებული.</p>';
  bindProductGridEvents(newGrid);
}

/* ---------------------------------------------------------------------
   PRODUCT DETAIL VIEW
--------------------------------------------------------------------- */
function renderSpecsTable(specs) {
  if (!specs || typeof specs !== 'object') return '<p class="muted">სპეციფიკაციები არ არის მითითებული.</p>';
  const entries = Object.entries(specs).filter(([k, v]) => v !== null && v !== undefined && v !== '');
  if (!entries.length) return '<p class="muted">სპეციფიკაციები არ არის მითითებული.</p>';
  return `<table class="pd-specs-table">${entries.map(([k, v]) =>
    `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>`;
}

async function renderProductDetail(id) {
  const container = $('#product-detail-container');
  container.innerHTML = '<div class="container section"><p class="muted">იტვირთება...</p></div>';

  const res = await ProductsAPI.getById(id);
  if (!res.ok || !res.product) {
    container.innerHTML = `<div class="container section"><p class="no-results">${escapeHtml(res.error || 'პროდუქტი ვერ მოიძებნა.')}</p></div>`;
    return;
  }
  const p = res.product;

  const images = [];
  if (isRealImage(p.imageUrl)) images.push(p.imageUrl);
  if (Array.isArray(p.imageUrls)) p.imageUrls.forEach(u => { if (isRealImage(u) && !images.includes(u)) images.push(u); });
  if (!images.length) images.push(placeholderImage(p.name, p.category && p.category.name));

  const catName = (p.category && p.category.name) || '';
  const isFav = state.favoriteIds.has(p.id);
  const soldOut = (p.stock ?? 0) <= 0;

  container.innerHTML = `
    <div class="container product-detail-layout">
      <div class="pd-gallery">
        <div class="pd-main-image"><img id="pd-main-img" src="${images[0]}" alt="${escapeHtml(p.name)}"></div>
        ${images.length > 1 ? `<div class="pd-thumbs">${images.map((img, i) =>
          `<button type="button" class="pd-thumb-btn ${i === 0 ? 'active' : ''}" data-img="${escapeHtml(img)}"><img src="${img}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="pd-info">
        <div class="product-meta">
          <span class="cat">${escapeHtml(catName)}</span>
          ${p.brand ? `<span class="brand">${escapeHtml(p.brand)}</span>` : ''}
        </div>
        <h1 class="pd-title">${escapeHtml(p.name)}</h1>
        <div class="product-rating">${starsHtml(p.rating)} <span>${(Number(p.rating) || 0).toFixed(1)}</span>
          <span class="muted">(<span id="pd-review-count">…</span> reviews)</span>
        </div>
        <div class="pd-price">${formatPrice(p.price)}</div>
        <div class="pd-stock ${soldOut ? 'out-of-stock' : 'in-stock'}">
          ${soldOut ? 'Out of Stock' : `✓ In Stock (${p.stock} available)`}
        </div>
        <p class="pd-description">${escapeHtml(p.description || '')}</p>
        <div class="pd-actions">
          <div class="qty-stepper" id="pd-qty-stepper">
            <button type="button" data-qty="dec">−</button>
            <span id="pd-qty-value">1</span>
            <button type="button" data-qty="inc">+</button>
          </div>
          <button type="button" class="btn btn-primary" id="pd-add-cart-btn" ${soldOut ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="margin-right:4px"><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${soldOut ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button type="button" class="icon-btn pd-fav-btn ${isFav ? 'active' : ''}" id="pd-fav-btn" aria-label="Toggle favorite">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}"><path d="M12 20s-7-4.35-9.5-8.8C.9 8.1 2.2 4.5 5.6 4c2-.3 3.7.7 4.9 2.3l1.5 2 1.5-2C14.7 4.7 16.4 3.7 18.4 4c3.4.5 4.7 4.1 3.1 7.2C19 15.65 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="container pd-tabs-section">
      <div class="pd-tabs">
        <button type="button" class="pd-tab-btn active" data-tab="description">Description</button>
        <button type="button" class="pd-tab-btn" data-tab="specifications">Specifications</button>
        <button type="button" class="pd-tab-btn" data-tab="reviews">Reviews (<span id="pd-tab-review-count">…</span>)</button>
      </div>
      <div class="pd-tab-panel" data-panel="description">${escapeHtml(p.description || 'აღწერა არ არის მითითებული.')}</div>
      <div class="pd-tab-panel" data-panel="specifications" hidden>${renderSpecsTable(p.specifications)}</div>
      <div class="pd-tab-panel" data-panel="reviews" hidden>
        <div id="pd-write-review"></div>
        <div id="pd-reviews-list"><p class="muted">იტვირთება...</p></div>
      </div>
    </div>`;

  bindProductDetailEvents(p, images);
  loadProductReviews(p.id);
}

function bindProductDetailEvents(p, images) {
  // გალერეის thumbnail-ები
  $all('.pd-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#pd-main-img').src = btn.dataset.img;
      $all('.pd-thumb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // რაოდენობის სტეპერი
  let qty = 1;
  const qtyEl = $('#pd-qty-value');
  $all('#pd-qty-stepper [data-qty]').forEach(btn => {
    btn.addEventListener('click', () => {
      const max = p.stock ?? 99;
      if (btn.dataset.qty === 'inc') qty = Math.min(max, qty + 1);
      else qty = Math.max(1, qty - 1);
      qtyEl.textContent = qty;
    });
  });

  // კალათაში დამატება
  const addBtn = $('#pd-add-cart-btn');
  if (addBtn) addBtn.addEventListener('click', () => handleAddToCart(p.id, qty));

  // ფავორიტი
  $('#pd-fav-btn').addEventListener('click', async () => {
    await handleToggleFavorite(p.id);
    const nowFav = state.favoriteIds.has(p.id);
    const btn = $('#pd-fav-btn');
    btn.classList.toggle('active', nowFav);
    btn.querySelector('svg').setAttribute('fill', nowFav ? 'currentColor' : 'none');
  });

  // ტაბები
  $all('.pd-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $all('.pd-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $all('.pd-tab-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== btn.dataset.tab; });
    });
  });
}

async function loadProductReviews(productId) {
  const res = await ReviewsAPI.get(productId);
  const listEl = $('#pd-reviews-list');
  const countEls = [$('#pd-review-count'), $('#pd-tab-review-count')];

  if (!res.ok) {
    listEl.innerHTML = `<p class="muted">შეფასებების ჩატვირთვა ვერ მოხერხდა.</p>`;
    return;
  }
  countEls.forEach(el => { if (el) el.textContent = res.totalCount; });

  const currentUser = Auth.getUser();
  let myReview = null;
  if (currentUser) {
    myReview = res.items.find(r => r.user && currentUser.email && r.user.email === currentUser.email) || null;
  }

  renderReviewWriteBox(productId, myReview);

  if (!res.items.length) {
    listEl.innerHTML = `<p class="muted">ჯერ არცერთი შეფასება არ არის — იყავი პირველი!</p>`;
    return;
  }
  listEl.innerHTML = res.items.map(r => {
    const u = r.user || {};
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'მომხმარებელი';
    const initials = (name[0] || '?').toUpperCase();
    const pictureUrl = u.details && isRealImage(u.details.pictureUrl) ? u.details.pictureUrl : null;
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ka-GE') : '';
    return `
    <div class="review-item">
      <div class="review-avatar">${pictureUrl ? `<img src="${pictureUrl}" alt="">` : escapeHtml(initials)}</div>
      <div class="review-body">
        <div class="review-head"><strong>${escapeHtml(name)}</strong><span class="muted">${date}</span></div>
        ${starsHtml(r.rating)}
      </div>
    </div>`;
  }).join('');
}

function renderReviewWriteBox(productId, myReview) {
  const box = $('#pd-write-review');
  if (!Auth.isLoggedIn()) {
    box.innerHTML = `<div class="review-write-box">შეფასების დასატოვებლად <a href="#/login" data-link>გაიარეთ ავტორიზაცია</a>.</div>`;
    return;
  }
  const currentRating = myReview ? myReview.rating : 0;
  box.innerHTML = `
    <div class="review-write-box">
      <span>${myReview ? 'თქვენი შეფასება:' : 'დაწერეთ შეფასება:'}</span>
      <div class="review-write-stars" id="review-write-stars">
        ${[1, 2, 3, 4, 5].map(i => `<span data-star="${i}" class="${i <= currentRating ? 'filled' : ''}">★</span>`).join('')}
      </div>
      ${myReview ? `<button type="button" class="btn btn-outline btn-sm" id="delete-review-btn">წაშლა</button>` : ''}
    </div>`;

  $all('#review-write-stars span').forEach(star => {
    star.addEventListener('click', async () => {
      const rate = Number(star.dataset.star);
      const res = myReview
        ? await ReviewsAPI.update(myReview.id, rate)
        : await ReviewsAPI.create(productId, rate);
      if (!res.ok) { toast(extractErrorMessage(res.data, 'შეფასება ვერ შენახულა'), 'error'); return; }
      toast('შეფასება შენახულია, მადლობა!', 'success');
      await loadProductReviews(productId);
      const prod = state.products.find(pr => pr.id === productId);
      if (prod) renderProductDetail(productId); // rating-ის განახლებული საშუალო ავტომატურად ჩანს
    });
  });

  const delBtn = $('#delete-review-btn');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const res = await ReviewsAPI.remove(productId);
      if (!res.ok) { toast(extractErrorMessage(res.data, 'ვერ წაიშალა'), 'error'); return; }
      toast('შეფასება წაიშალა', 'success');
      await loadProductReviews(productId);
    });
  }
}

/* ---------------------------------------------------------------------
   SHOP VIEW — filtering / sorting / searching / pagination
--------------------------------------------------------------------- */
function renderFilterPanel() {
  const catList = $('#category-filter-list');
  catList.innerHTML = state.categories.map(c => `
    <label class="filter-option-row">
      <input type="radio" name="category-filter" value="${escapeHtml(c.name)}" ${state.filters.category === c.name ? 'checked' : ''}>
      ${escapeHtml(c.name)}
      <span class="count">${c.productCount ?? 0}</span>
    </label>`).join('');
  $all('input[name="category-filter"]', catList).forEach(inp => {
    inp.addEventListener('change', () => {
      state.filters.category = inp.value;
      state.shopPage = 1;
      renderShop();
    });
  });

  const ratingList = $('#rating-filter-list');
  const ratingOptions = [4, 3, 2, 1];
  ratingList.innerHTML = ratingOptions.map(r => `
    <label class="filter-option-row">
      <input type="radio" name="rating-filter" value="${r}" ${state.filters.minRating === r ? 'checked' : ''}>
      <span class="stars-inline">${'★'.repeat(r)}${'☆'.repeat(5 - r)}</span> ${r} &amp; up
    </label>`).join('');
  $all('input[name="rating-filter"]', ratingList).forEach(inp => {
    inp.addEventListener('change', () => {
      state.filters.minRating = Number(inp.value);
      state.shopPage = 1;
      renderShop();
    });
  });

  $('#price-min-input').value = state.filters.priceMin ?? '';
  $('#price-max-input').value = state.filters.priceMax ?? '';
  $('#brand-filter-input').value = state.filters.brand || '';
  $('#instock-filter-input').checked = !!state.filters.inStock;
}

function getFilteredSortedProducts() {
  const f = state.filters;
  let list = state.products.filter(p => {
    if (f.category && (!p.category || p.category.name !== f.category)) return false;
    if (f.minRating && (Number(p.rating) || 0) < f.minRating) return false;
    if (f.priceMin != null && f.priceMin !== '' && Number(p.price) < Number(f.priceMin)) return false;
    if (f.priceMax != null && f.priceMax !== '' && Number(p.price) > Number(f.priceMax)) return false;
    if (f.brand && !(p.brand || '').toLowerCase().includes(f.brand.toLowerCase())) return false;
    if (f.inStock && !((p.stock ?? 0) > 0)) return false;
    if (f.search) {
      const s = f.search.toLowerCase();
      const hay = `${p.name || ''} ${p.brand || ''} ${p.model || ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  switch (f.sort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'rating-desc': list.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case 'name-asc': list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
    case 'newest': list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); break;
    default: break;
  }
  return list;
}

function renderShop() {
  renderFilterPanel();

  $('#shop-search-input').value = state.filters.search || '';
  $('#header-search-input').value = state.filters.search || '';
  $('#sort-select').value = state.filters.sort || 'default';

  const filtered = getFilteredSortedProducts();
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize));
  if (state.shopPage > totalPages) state.shopPage = totalPages;
  const start = (state.shopPage - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);

  $('#results-count').textContent = `${totalCount} products`;

  const grid = $('#product-grid-container');
  grid.innerHTML = pageItems.map(renderProductCard).join('');
  bindProductGridEvents(grid);

  $('#no-results-msg').hidden = totalCount !== 0;

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = $('#pagination-container');
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  const cur = state.shopPage;
  let pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - cur) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  const btn = (label, page, disabled, active) =>
    `<button type="button" ${disabled ? 'disabled' : ''} class="${active ? 'active' : ''}" data-page="${page ?? ''}">${label}</button>`;

  container.innerHTML =
    btn('‹', cur - 1, cur === 1, false) +
    pages.map(p => p === '…' ? `<span style="padding:0 6px;color:var(--color-muted)">…</span>` : btn(p, p, false, p === cur)).join('') +
    btn('›', cur + 1, cur === totalPages, false);

  $all('button[data-page]', container).forEach(b => {
    b.addEventListener('click', () => {
      const page = Number(b.dataset.page);
      if (page) { state.shopPage = page; renderShop(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
  });
}

function clearAllFilters() {
  state.filters = { category: null, minRating: 0, priceMin: null, priceMax: null, brand: '', inStock: false, search: '', sort: 'default' };
  state.shopPage = 1;
  renderShop();
}

/* ---------------------------------------------------------------------
   FAVORITES VIEW
--------------------------------------------------------------------- */
async function renderFavoritesView() {
  if (!Auth.isLoggedIn()) {
    $('#favorites-grid-container').innerHTML = '';
    $('#favorites-empty-msg').hidden = false;
    $('#favorites-empty-msg').textContent = 'ფავორიტების სანახავად საჭიროა ავტორიზაცია.';
    return;
  }
  const res = await FavoritesAPI.get();
  const grid = $('#favorites-grid-container');
  if (!res.ok) {
    grid.innerHTML = '';
    $('#favorites-empty-msg').hidden = false;
    $('#favorites-empty-msg').textContent = 'ფავორიტების ჩატვირთვა ვერ მოხერხდა.';
    return;
  }
  state.favoriteIds = new Set(res.items.map(p => p.id));
  updateFavoritesBadge();
  if (!res.items.length) {
    grid.innerHTML = '';
    $('#favorites-empty-msg').hidden = false;
    return;
  }
  $('#favorites-empty-msg').hidden = true;
  grid.innerHTML = res.items.map(renderProductCard).join('');
  bindProductGridEvents(grid);
}

async function handleToggleFavorite(productId) {
  if (!Auth.isLoggedIn()) {
    toast('ფავორიტებში დამატებისთვის საჭიროა ავტორიზაცია', 'error');
    location.hash = '#/login';
    return;
  }
  const alreadyFav = state.favoriteIds.has(productId);
  const res = alreadyFav ? await FavoritesAPI.remove(productId) : await FavoritesAPI.add(productId);
  if (!res.ok) { toast(extractErrorMessage(res.data, 'ვერ მოხერხდა'), 'error'); return; }

  if (alreadyFav) state.favoriteIds.delete(productId); else state.favoriteIds.add(productId);
  const prod = state.products.find(p => p.id === productId);
  if (prod) prod.isFavorite = !alreadyFav;
  updateFavoritesBadge();

  // მიმდინარე ეკრანზე ყველა ბარათს ვასინქრონებთ თავიდან რენდერის გარეშე
  $all(`[data-fav-id="${productId}"]`).forEach(btn => {
    const nowFav = state.favoriteIds.has(productId);
    btn.classList.toggle('active', nowFav);
    btn.querySelector('svg').setAttribute('fill', nowFav ? 'currentColor' : 'none');
  });
  toast(alreadyFav ? 'ფავორიტებიდან წაიშალა' : 'დაემატა ფავორიტებში', 'success');
}

function updateFavoritesBadge() {
  const badge = $('#favorites-badge');
  const count = state.favoriteIds.size;
  badge.hidden = count === 0;
  badge.textContent = count;
}

/* ---------------------------------------------------------------------
   CART
--------------------------------------------------------------------- */
async function refreshCart() {
  if (!Auth.isLoggedIn()) { state.cart = []; updateCartBadge(); return; }
  const res = await CartAPI.get();
  if (res.ok) { state.cart = res.items; state.cartLoaded = true; }
  updateCartBadge();
}

function updateCartBadge() {
  const badge = $('#cart-badge');
  const count = state.cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  badge.hidden = count === 0;
  badge.textContent = count;
}

async function handleAddToCart(productId, quantity = 1) {
  if (!Auth.isLoggedIn()) {
    toast('კალათაში დამატებისთვის საჭიროა ავტორიზაცია — გთხოვთ შეხვიდეთ სისტემაში', 'error');
    location.hash = '#/login';
    return;
  }
  const res = await CartAPI.addToCart(productId, quantity);
  if (!res.ok) { toast(extractErrorMessage(res.data, 'ვერ დაემატა კალათაში'), 'error'); return; }
  toast('პროდუქტი დაემატა კალათაში', 'success');
  await refreshCart();
  if (!$('#cart-drawer').classList.contains('open')) return;
  renderCartDrawer();
}

function renderCartDrawer() {
  const body = $('#cart-items-container');
  const footer = $('#cart-drawer-footer');

  if (!Auth.isLoggedIn()) {
    body.innerHTML = `<div class="cart-empty-state">კალათის სანახავად საჭიროა <a href="#/login" data-link>ავტორიზაცია</a>.</div>`;
    footer.style.display = 'none';
    return;
  }
  if (!state.cart.length) {
    body.innerHTML = `<div class="cart-empty-state">კალათა ცარიელია.</div>`;
    footer.style.display = 'none';
    return;
  }
  footer.style.display = '';
  body.innerHTML = state.cart.map(item => {
    const p = item.product || {};
    const productId = p.id ?? item.productId ?? item.product_id;
    return `
    <div class="cart-line-item" data-item-id="${item.id}" data-product-id="${productId}">
      <div class="cart-line-thumb"><img src="${productImageUrl(p)}" alt="${escapeHtml(p.name || '')}"
        onerror="this.onerror=null;this.src='${placeholderImage(p.name, p.category && p.category.name)}'"></div>
      <div class="cart-line-info">
        <h4>${escapeHtml(p.name || 'პროდუქტი')}</h4>
        <div class="brand">${escapeHtml(p.brand || '')}</div>
        <div class="cart-line-controls">
          <div class="qty-stepper">
            <button type="button" data-qty-action="dec">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-qty-action="inc">+</button>
          </div>
          <span class="cart-line-price">${formatPrice(item.totalPrice ?? (item.price * item.quantity))}</span>
        </div>
      </div>
      <button type="button" class="cart-remove-btn" data-remove-product="${productId}" aria-label="Remove">✕</button>
    </div>`;
  }).join('');

  const subtotal = state.cart.reduce((sum, item) => sum + (item.totalPrice ?? (item.price * item.quantity)), 0);
  $('#cart-subtotal').textContent = formatPrice(subtotal);

  $all('[data-qty-action]', body).forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const line = btn.closest('.cart-line-item');
        const itemId = Number(line.dataset.itemId);
        const productId = Number(line.dataset.productId);
        const item = state.cart.find(i => i.id === itemId);
        if (!item) { console.warn('[Cart] item not found for itemId', itemId); btn.disabled = false; return; }
        const delta = btn.dataset.qtyAction === 'inc' ? 1 : -1;
        const newQty = item.quantity + delta;
        let res;
        if (newQty <= 0) {
          console.log('[Cart] removing product (qty->0)', productId);
          res = await CartAPI.removeFromCart(productId);
          if (!res.ok && res.status === 404 && itemId !== productId) {
            console.warn('[Cart] productId-ით 404, ვცდი itemId-ს:', itemId);
            res = await CartAPI.removeFromCart(itemId);
          }
        } else {
          console.log('[Cart] editing quantity', { itemId, newQty });
          res = await CartAPI.editQuantity(itemId, newQty);
        }
        if (res && !res.ok) { toast(extractErrorMessage(res.data, `ვერ განახლდა (სტატუსი: ${res.status})`), 'error'); console.warn('[Cart] qty action failed:', res); }
        await refreshCart();
        renderCartDrawer();
      } catch (err) {
        console.error('[Cart] qty action threw:', err);
        toast('დაფიქსირდა შეცდომა კალათის განახლებისას', 'error');
        btn.disabled = false;
      }
    });
  });
  $all('[data-remove-product]', body).forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return; // ორმაგი დაწკაპუნების დაცვა
      btn.disabled = true;
      try {
        const line = btn.closest('.cart-line-item');
        const itemId = Number(line.dataset.itemId);
        const productId = Number(btn.dataset.removeProduct);
        console.log('[Cart] remove clicked — itemId:', itemId, 'productId:', productId);
        if (!productId || Number.isNaN(productId)) {
          console.error('[Cart] invalid productId, cannot remove. Full cart state:', state.cart);
          toast('ვერ მოხერხდა პროდუქტის იდენტიფიცირება — იხილეთ console', 'error');
          btn.disabled = false;
          return;
        }
        let res = await CartAPI.removeFromCart(productId);

        // თუ productId-ით 404 დაბრუნდა, ვცდილობთ itemId-ით — ზოგ backend-ს
        // შეიძლება რეალურად cart-line-ის ID სჭირდებოდეს, მიუხედავად Swagger-ის "productId" სახელისა
        if (!res.ok && res.status === 404 && itemId && !Number.isNaN(itemId) && itemId !== productId) {
          console.warn('[Cart] productId-ით 404 დაბრუნდა, ვცდი itemId-ს:', itemId);
          res = await CartAPI.removeFromCart(itemId);
        }

        if (!res.ok) {
          console.warn('[Cart] removeFromCart საბოლოოდ ვერ შესრულდა:', res);
          toast(extractErrorMessage(res.data, `ვერ წაიშალა (სტატუსი: ${res.status})`), 'error');
          btn.disabled = false;
          return;
        }
        toast('პროდუქტი წაიშალა კალათიდან', 'success');
        await refreshCart();
        renderCartDrawer();
      } catch (err) {
        console.error('[Cart] remove threw:', err);
        toast('დაფიქსირდა შეცდომა წაშლისას', 'error');
        btn.disabled = false;
      }
    });
  });
}

function openCartDrawer() {
  $('#cart-drawer').classList.add('open');
  $('#cart-drawer').setAttribute('aria-hidden', 'false');
  $('#drawer-overlay').classList.add('open');
  renderCartDrawer();
}
function closeCartDrawer() {
  $('#cart-drawer').classList.remove('open');
  $('#cart-drawer').setAttribute('aria-hidden', 'true');
  $('#drawer-overlay').classList.remove('open');
}

async function handleCheckout() {
  if (!state.cart.length) return;
  const btn = $('#checkout-btn');
  btn.disabled = true;
  btn.textContent = 'მუშავდება...';
  const res = await CartAPI.checkout();
  btn.disabled = false;
  btn.textContent = 'გადახდა';
  if (!res.ok) {
    toast(extractErrorMessage(res.data, 'გადახდა ვერ განხორციელდა'), 'error');
    return;
  }
  toast('შეკვეთა წარმატებით გაფორმდა!', 'success');
  await refreshCart();
  renderCartDrawer();
  closeCartDrawer();
}

/* ---------------------------------------------------------------------
   AUTH VIEW — login / register / forgot-password / reset-password / verify-email
--------------------------------------------------------------------- */
function passwordRuleCheck(pw) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw)
  };
}

function authShellStart() {
  return `<span class="auth-form-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l5-5-5-5M15 12H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
}

function renderAuthForm(path, params) {
  const wrap = $('#auth-form-wrap');

  if (path === '/login') {
    wrap.innerHTML = `
      ${authShellStart()}
      <h2>Welcome Back</h2>
      <p class="auth-subtitle">Sign in to continue shopping</p>
      <form id="login-form">
        <div class="form-field">
          <label>Email address</label>
          <input class="form-input" type="email" id="login-email" required autocomplete="email">
        </div>
        <div class="form-field">
          <label>Password</label>
          <input class="form-input" type="password" id="login-password" required autocomplete="current-password">
        </div>
        <div class="form-row-between">
          <label class="form-check"><input type="checkbox" id="login-remember"> Remember me</label>
          <a href="#/forgot-password" data-link>Forgot password?</a>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="login-submit-btn">Sign In</button>
      </form>
      <div class="auth-divider">or</div>
      <p class="auth-switch">Don't have an account? <a href="#/register" data-link>Create one now</a></p>`;

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      const btn = $('#login-submit-btn');
      btn.disabled = true; btn.textContent = 'იტვირთება...';
      const res = await AuthAPI.login(email, password);
      btn.disabled = false; btn.textContent = 'Sign In';
      if (!res.ok) {
        toast(extractErrorMessage(res.data, 'ავტორიზაცია ვერ მოხერხდა'), 'error');
        return;
      }
      const { token, user } = extractTokenAndUser(res.data);
      if (!token) {
        toast('სერვერმა წარმატებული პასუხი დააბრუნა, მაგრამ ტოკენი ვერ მოიძებნა', 'error');
        console.warn('Login success but no token found in response:', res.data);
        return;
      }
      Auth.setToken(token);
      Auth.setUser(user);
      const meRes = await UsersAPI.me();
      if (meRes.ok) Auth.setUser(meRes.user);
      renderHeaderAuthArea();
      await Promise.all([refreshCart(), refreshFavoritesBadgeOnly()]);
      toast('წარმატებით შეხვედით სისტემაში', 'success');
      location.hash = '#/';
    });
    return;
  }

  if (path === '/register') {
    wrap.innerHTML = `
      ${authShellStart()}
      <h2>Create Account</h2>
      <p class="auth-subtitle">Join STEP TECH for exclusive deals</p>
      <form id="register-form">
        <div class="form-field">
          <label>First name</label>
          <input class="form-input" type="text" id="reg-firstname" required>
        </div>
        <div class="form-field">
          <label>Last name</label>
          <input class="form-input" type="text" id="reg-lastname" required>
        </div>
        <div class="form-field">
          <label>Email address</label>
          <input class="form-input" type="email" id="reg-email" required>
        </div>
        <div class="form-field">
          <label>Password</label>
          <input class="form-input" type="password" id="reg-password" required>
        </div>
        <ul class="password-rules" id="password-rules">
          <li data-rule="length">✓ მინიმუმ 8 სიმბოლო</li>
          <li data-rule="upper">✓ მინიმუმ 1 დიდი ასო</li>
          <li data-rule="digit">✓ მინიმუმ 1 ციფრი</li>
          <li data-rule="special">✓ მინიმუმ 1 სპეციალური სიმბოლო</li>
        </ul>
        <button type="submit" class="btn btn-primary btn-block" id="register-submit-btn">Create Account</button>
      </form>
      <div class="auth-divider">or</div>
      <p class="auth-switch">Already have an account? <a href="#/login" data-link>Sign in</a></p>`;

    const pwInput = $('#reg-password');
    pwInput.addEventListener('input', () => {
      const rules = passwordRuleCheck(pwInput.value);
      Object.entries(rules).forEach(([key, ok]) => {
        const li = $(`#password-rules [data-rule="${key}"]`);
        if (li) li.classList.toggle('ok', ok);
      });
    });

    $('#register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = $('#reg-firstname').value.trim();
      const lastName = $('#reg-lastname').value.trim();
      const email = $('#reg-email').value.trim();
      const password = pwInput.value;
      const btn = $('#register-submit-btn');
      btn.disabled = true; btn.textContent = 'იტვირთება...';
      const res = await AuthAPI.register(firstName, lastName, email, password);
      btn.disabled = false; btn.textContent = 'Create Account';
      if (!res.ok) {
        toast(extractErrorMessage(res.data, 'რეგისტრაცია ვერ მოხერხდა'), 'error');
        return;
      }
      toast('რეგისტრაცია წარმატებულია! გთხოვთ დაადასტუროთ ელფოსტა.', 'success');
      location.hash = `#/verify-email?email=${encodeURIComponent(email)}`;
    });
    return;
  }

  if (path === '/forgot-password') {
    wrap.innerHTML = `
      ${authShellStart()}
      <h2>Forgot Password</h2>
      <p class="auth-subtitle">Enter your email and we'll send you a reset link</p>
      <form id="forgot-form">
        <div class="form-field">
          <label>Email address</label>
          <input class="form-input" type="email" id="forgot-email" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="forgot-submit-btn">Send Reset Link</button>
      </form>
      <p class="auth-switch" style="margin-top:16px">Remembered it? <a href="#/login" data-link>Sign in</a></p>`;

    $('#forgot-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#forgot-email').value.trim();
      const btn = $('#forgot-submit-btn');
      btn.disabled = true; btn.textContent = 'იგზავნება...';
      const res = await AuthAPI.forgotPassword(email);
      btn.disabled = false; btn.textContent = 'Send Reset Link';
      if (!res.ok) { toast(extractErrorMessage(res.data, 'ვერ გაიგზავნა'), 'error'); return; }
      toast('თუ ეს ელფოსტა არსებობს, აღდგენის ბმული გაიგზავნა.', 'success');
    });
    return;
  }

  if (path === '/reset-password') {
    const token = params.get('token') || '';
    wrap.innerHTML = `
      ${authShellStart()}
      <h2>Reset Password</h2>
      <p class="auth-subtitle">Choose a new password for your account</p>
      <form id="reset-form">
        ${!token ? `<div class="form-field"><label>Reset Token</label><input class="form-input" type="text" id="reset-token" placeholder="ჩასვით ბმულიდან მიღებული ტოკენი" required></div>` : `<input type="hidden" id="reset-token" value="${escapeHtml(token)}">`}
        <div class="form-field">
          <label>New password</label>
          <input class="form-input" type="password" id="reset-password-input" required>
        </div>
        <ul class="password-rules" id="reset-password-rules">
          <li data-rule="length">✓ მინიმუმ 8 სიმბოლო</li>
          <li data-rule="upper">✓ მინიმუმ 1 დიდი ასო</li>
          <li data-rule="digit">✓ მინიმუმ 1 ციფრი</li>
          <li data-rule="special">✓ მინიმუმ 1 სპეციალური სიმბოლო</li>
        </ul>
        <button type="submit" class="btn btn-primary btn-block" id="reset-submit-btn">Reset Password</button>
      </form>`;

    const pwInput = $('#reset-password-input');
    pwInput.addEventListener('input', () => {
      const rules = passwordRuleCheck(pwInput.value);
      Object.entries(rules).forEach(([key, ok]) => {
        const li = $(`#reset-password-rules [data-rule="${key}"]`);
        if (li) li.classList.toggle('ok', ok);
      });
    });

    $('#reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const tokenVal = $('#reset-token').value.trim();
      const password = pwInput.value;
      const btn = $('#reset-submit-btn');
      btn.disabled = true; btn.textContent = 'იგზავნება...';
      const res = await AuthAPI.resetPassword(tokenVal, password);
      btn.disabled = false; btn.textContent = 'Reset Password';
      if (!res.ok) { toast(extractErrorMessage(res.data, 'პაროლი ვერ განახლდა'), 'error'); return; }
      toast('პაროლი წარმატებით განახლდა! გთხოვთ შეხვიდეთ სისტემაში.', 'success');
      location.hash = '#/login';
    });
    return;
  }

  if (path === '/verify-email') {
    const email = params.get('email') || '';
    wrap.innerHTML = `
      ${authShellStart()}
      <h2>Verify Your Email</h2>
      <p class="auth-subtitle">კოდი გამოგზავნილია ${escapeHtml(email) || 'თქვენს ელფოსტაზე'}</p>
      <form id="verify-form">
        <div class="form-field">
          <label>Email address</label>
          <input class="form-input" type="email" id="verify-email" value="${escapeHtml(email)}" required>
        </div>
        <div class="form-field">
          <label>Verification code</label>
          <input class="form-input" type="text" id="verify-code" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="verify-submit-btn">Verify Email</button>
      </form>
      <p class="auth-switch" style="margin-top:16px">კოდი არ მოგივიდათ? <button type="button" id="resend-code-btn">ხელახლა გაგზავნა</button></p>`;

    $('#verify-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailVal = $('#verify-email').value.trim();
      const code = $('#verify-code').value.trim();
      const btn = $('#verify-submit-btn');
      btn.disabled = true; btn.textContent = 'მოწმდება...';
      const res = await AuthAPI.verifyEmail(emailVal, code);
      btn.disabled = false; btn.textContent = 'Verify Email';
      if (!res.ok) { toast(extractErrorMessage(res.data, 'ვერ დადასტურდა'), 'error'); return; }
      toast('ელფოსტა წარმატებით დადასტურდა! გთხოვთ შეხვიდეთ სისტემაში.', 'success');
      location.hash = '#/login';
    });
    $('#resend-code-btn').addEventListener('click', async () => {
      const emailVal = $('#verify-email').value.trim();
      if (!emailVal) { toast('შეიყვანეთ ელფოსტა', 'error'); return; }
      const res = await AuthAPI.resendVerification(emailVal);
      if (!res.ok) { toast(extractErrorMessage(res.data, 'ვერ გაიგზავნა'), 'error'); return; }
      toast('კოდი ხელახლა გაიგზავნა', 'success');
    });
    return;
  }
}

async function refreshFavoritesBadgeOnly() {
  if (!Auth.isLoggedIn()) return;
  const res = await FavoritesAPI.get();
  if (res.ok) {
    state.favoriteIds = new Set(res.items.map(p => p.id));
    updateFavoritesBadge();
  }
}

/* ---------------------------------------------------------------------
   Global event bindings
--------------------------------------------------------------------- */
function bindStaticEvents() {
  // მობილური მენიუ
  $('#mobile-menu-btn').addEventListener('click', toggleMobileNav);

  // Categories dropdown (header)
  const catDropdown = $('.nav-dropdown');
  $('.nav-dropdown-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    catDropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown')) $all('.nav-dropdown.open').forEach(d => d.classList.remove('open'));
    if (!e.target.closest('.auth-menu-wrap')) $all('.auth-menu-wrap.open').forEach(d => d.classList.remove('open'));
  });

  $all('a[data-link]').forEach(a => a.addEventListener('click', closeMobileNav));
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[data-link]')) closeMobileNav();
  });

  // Search — header + mobile + shop, ყველა state.filters.search-ს ავსებს და shop-ზე გადადის
  function goSearch(value) {
    state.filters.search = value.trim();
    state.shopPage = 1;
    if (parseHash().path !== '/shop') { location.hash = '#/shop'; }
    else renderShop();
  }
  $('#header-search-form').addEventListener('submit', (e) => { e.preventDefault(); goSearch($('#header-search-input').value); });
  $('#mobile-search-form').addEventListener('submit', (e) => { e.preventDefault(); goSearch($('#mobile-search-input').value); });
  $('#shop-search-form').addEventListener('submit', (e) => { e.preventDefault(); goSearch($('#shop-search-input').value); });
  const debouncedShopSearch = debounce((v) => { state.filters.search = v; state.shopPage = 1; renderShop(); }, 300);
  $('#shop-search-input').addEventListener('input', (e) => debouncedShopSearch(e.target.value));

  // Sort
  $('#sort-select').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    state.shopPage = 1;
    renderShop();
  });

  // Price range + brand + in-stock
  const debouncedPrice = debounce(() => { state.shopPage = 1; renderShop(); }, 350);
  $('#price-min-input').addEventListener('input', (e) => { state.filters.priceMin = e.target.value === '' ? null : Number(e.target.value); debouncedPrice(); });
  $('#price-max-input').addEventListener('input', (e) => { state.filters.priceMax = e.target.value === '' ? null : Number(e.target.value); debouncedPrice(); });
  const debouncedBrand = debounce(() => { state.shopPage = 1; renderShop(); }, 300);
  $('#brand-filter-input').addEventListener('input', (e) => { state.filters.brand = e.target.value; debouncedBrand(); });
  $('#instock-filter-input').addEventListener('change', (e) => { state.filters.inStock = e.target.checked; state.shopPage = 1; renderShop(); });

  $('#clear-filters-btn').addEventListener('click', clearAllFilters);

  // Cart drawer
  $('#cart-toggle-btn').addEventListener('click', openCartDrawer);
  $('#cart-close-btn').addEventListener('click', closeCartDrawer);
  $('#drawer-overlay').addEventListener('click', closeCartDrawer);
  $('#checkout-btn').addEventListener('click', handleCheckout);

  // Favorites icon -> route
  $('#favorites-toggle-btn').addEventListener('click', () => { location.hash = '#/favorites'; });

  window.addEventListener('hashchange', router);
}

/* ---------------------------------------------------------------------
   Bootstrap
--------------------------------------------------------------------- */
async function init() {
  bindStaticEvents();

  const [catRes, prodRes] = await Promise.all([CategoriesAPI.list(), ProductsAPI.listAll()]);
  if (catRes.ok) state.categories = catRes.categories; else toast(catRes.error, 'error');
  if (prodRes.ok) state.products = prodRes.items; else toast(prodRes.error, 'error');
  renderCategoryDropdown();

  if (Auth.isLoggedIn()) {
    const meRes = await UsersAPI.me();
    if (meRes.ok) {
      Auth.setUser(meRes.user);
    } else if (meRes.status === 401) {
      Auth.logout();
    }
    await Promise.all([refreshCart(), refreshFavoritesBadgeOnly()]);
  }
  renderHeaderAuthArea();

  await router();
}

document.addEventListener('DOMContentLoaded', init);
