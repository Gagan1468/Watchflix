// app.js (Option C - Beast Mode)
// Requires: your index.html and styles.css from earlier.
// Uses TMDB API key (you provided). For prod, proxy these requests.
const TMDB_API_KEY = '63c62d92d97c823fcf668b74693bf705';

const ROWS = [
  { id: 'trending', title: 'Trending Now', url: `https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US` },
  { id: 'top_rated', title: 'Top Rated', url: `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1` },
  { id: 'popular_tv', title: 'Popular TV', url: `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1` },
  { id: 'upcoming', title: 'Upcoming Movies', url: `https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1` },
  { id: 'now_playing', title: 'Now Playing', url: `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1` }
];

const IMG_BASE = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

const $ = s => document.querySelector(s);
const createEl = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };

// simple cache to avoid repeated fetches
const CACHE = {
  rows: {},
  videos: {},
  search: {}
};

function debounce(fn, wait=220){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

async function fetchJson(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

/* ---------- UI HELPERS ---------- */

function showSkeletonRows(){
  const container = $('#rows');
  container.innerHTML = '';
  for(let i=0;i<ROWS.length;i++){
    const section = createEl('div','row');
    const h = createEl('h2'); h.textContent = ROWS[i].title;
    const cards = createEl('div','row-cards');
    // add 7 skeleton cards
    for(let k=0;k<7;k++){
      const sk = createEl('div','card skeleton');
      cards.appendChild(sk);
    }
    section.appendChild(h);
    section.appendChild(cards);
    container.appendChild(section);
  }
}

function clearRowsAndShowMessage(msg){
  const container = $('#rows');
  container.innerHTML = `<p style="color:#999;padding:24px">${msg}</p>`;
}

function setHero(item){
  if(!item) return;
  const title = item.title || item.name || item.original_name || 'Untitled';
  $('#hero-title').textContent = title;
  $('#hero-overview').textContent = item.overview || '';
  const backdrop = item.backdrop_path || item.poster_path || '';
  $('#hero-backdrop').style.backgroundImage = backdrop ? `url(${IMG_BASE + backdrop})` : '';
  // attach hero CTAs
  $('#hero-play').onclick = () => openDetail(item);
  $('#hero-info').onclick = () => openDetail(item);
}

/* ---------- RENDERING ROWS ---------- */

function createPosterCard(item){
  const el = createEl('div','card');
  const img = createEl('img');
  img.alt = item.title || item.name || '';
  img.src = item.poster_path ? (POSTER_BASE + item.poster_path) : (item.backdrop_path ? POSTER_BASE + item.backdrop_path : '');
  el.appendChild(img);
  const meta = createEl('div','meta');
  meta.textContent = (item.title || item.name || '').slice(0,30);
  el.appendChild(meta);

  // hover preview: on mouseenter fetch videos and show overlay
  let previewTimeout;
  el.addEventListener('mouseenter', (ev) => {
    previewTimeout = setTimeout(() => showHoverPreview(el, item), 280);
  });
  el.addEventListener('mouseleave', () => {
    clearTimeout(previewTimeout);
    hideHoverPreview(el);
  });

  el.addEventListener('click', () => openDetail(item));
  return el;
}

async function renderRows(rowsData){
  const container = $('#rows');
  container.innerHTML = '';
  for(const r of rowsData){
    if(!r.data || !r.data.results) continue;
    const section = createEl('div','row');
    const h2 = createEl('h2'); h2.textContent = r.title;
    const cards = createEl('div','row-cards');
    for(const item of r.data.results){
      const card = createPosterCard(item);
      cards.appendChild(card);
    }
    section.appendChild(h2);
    section.appendChild(cards);
    container.appendChild(section);
  }
}

/* ---------- HERO SLIDESHOW ---------- */

let heroList = [];
let heroIndex = 0;
let heroInterval = null;

function startHeroSlideshow(items){
  heroList = items.filter(i => i.backdrop_path || i.poster_path);
  if(!heroList.length) return;
  // set first
  heroIndex = 0;
  setHero(heroList[heroIndex]);
  // cycle
  if(heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroList.length;
    setHero(heroList[heroIndex]);
  }, 8000);
}

/* ---------- HOVER PREVIEW ---------- */

function showHoverPreview(cardEl, item){
  // if already has overlay, do nothing
  if(cardEl.querySelector('.preview-overlay')) return;
  const id = item.id;
  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
  // overlay container
  const overlay = createEl('div','preview-overlay');
  overlay.innerHTML = `<div class="preview-inner">Loading…</div>`;
  cardEl.appendChild(overlay);

  // fetch videos (cached)
  const cacheKey = `${mediaType}_${id}`;
  if(CACHE.videos[cacheKey]){
    renderPreviewContent(overlay, CACHE.videos[cacheKey]);
    return;
  }
  fetchJson(`https://api.themoviedb.org/3/${mediaType}/${id}/videos?api_key=${TMDB_API_KEY}&language=en-US`)
    .then(data => {
      const vids = (data.results || []).filter(v => v.site === 'YouTube');
      CACHE.videos[cacheKey] = vids;
      renderPreviewContent(overlay, vids);
    })
    .catch(() => {
      overlay.innerHTML = `<div class="preview-inner no-video">No preview</div>`;
    });
}

function renderPreviewContent(overlayEl, videos){
  if(!videos || !videos.length){
    overlayEl.innerHTML = `<div class="preview-inner no-video">No preview</div>`;
    return;
  }
  // prefer Trailer then Teaser
  const v = videos.find(v=>v.type==='Trailer') || videos[0];
  // embed small youtube with autoplay muted loop (use rel=0)
  overlayEl.innerHTML = `
    <div class="preview-inner">
      <iframe src="https://www.youtube.com/embed/${v.key}?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist=${v.key}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    </div>
  `;
}

function hideHoverPreview(cardEl){
  const overlay = cardEl.querySelector('.preview-overlay');
  if(overlay) overlay.remove();
}

/* ---------- MODAL + DETAILS ---------- */

async function openDetail(item){
  const modal = $('#modal');
  const body = $('#modal-body');
  modal.classList.remove('hidden');
  body.innerHTML = `<p style="color:#9aa4ad">Loading details…</p>`;

  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
  try {
    // fetch full details
    const details = await fetchJson(`https://api.themoviedb.org/3/${mediaType}/${item.id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos,credits`);
    const poster = details.poster_path ? POSTER_BASE + details.poster_path : '';
    const title = details.title || details.name || '';
    const rating = details.vote_average ? `${details.vote_average}/10` : 'N/A';
    const overview = details.overview || 'No description available.';
    // build modal
    body.innerHTML = `
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        ${poster ? `<img src="${poster}" alt="${title}" style="width:240px;border-radius:8px">` : ''}
        <div style="flex:1;min-width:220px">
          <h3 style="margin:0 0 8px">${title}</h3>
          <p style="color:#9aa4ad;margin:0 0 8px"><strong>Rating:</strong> ${rating}</p>
          <p style="color:#b6bcc2;line-height:1.4">${overview}</p>
          <div id="modal-actions" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap"></div>
        </div>
      </div>
    `;
    const actions = $('#modal-actions');
    // trailer if available
    const vids = (details.videos && details.videos.results) || [];
    const yt = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer');
    if(yt){
      const playBtn = createEl('button','btn primary'); playBtn.textContent = '▶ Play Trailer';
      playBtn.onclick = () => openTrailer(yt.key);
      actions.appendChild(playBtn);
    }
    const tmdbBtn = createEl('a','btn ghost'); tmdbBtn.textContent = 'Open on TMDB';
    tmdbBtn.href = `https://www.themoviedb.org/${mediaType}/${details.id}`;
    tmdbBtn.target = '_blank';
    actions.appendChild(tmdbBtn);

  } catch(e){
    body.innerHTML = `<p style="color:#f88">Failed to load details</p>`;
    console.error(e);
  }
}

function openTrailer(youtubeKey){
  const modal = $('#modal');
  $('#modal-body').innerHTML = `<div style="position:relative;padding-top:56.25%"><iframe src="https://www.youtube.com/embed/${youtubeKey}?autoplay=1" allow="autoplay; encrypted-media" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px"></iframe></div>`;
  modal.classList.remove('hidden');
}

function attachModalHandlers(){
  $('#modal-close').onclick = () => $('#modal').classList.add('hidden');
  $('#modal').addEventListener('click', (e) => { if(e.target === $('#modal')) $('#modal').classList.add('hidden'); });
}

/* ---------- SEARCH SUGGESTIONS ---------- */

function attachSearchBox(){
  // create suggestions container under header right (so no HTML changes needed)
  const right = document.querySelector('.right');
  let sugg = document.getElementById('search-suggestions');
  if(!sugg){
    sugg = createEl('div','suggestions hidden');
    sugg.id = 'search-suggestions';
    sugg.style.position = 'absolute';
    sugg.style.top = '64px';
    sugg.style.right = '60px';
    sugg.style.width = '320px';
    sugg.style.maxHeight = '60vh';
    sugg.style.overflowY = 'auto';
    sugg.style.background = '#0b0b0b';
    sugg.style.border = '1px solid rgba(255,255,255,0.06)';
    sugg.style.borderRadius = '8px';
    sugg.style.zIndex = '400';
    document.body.appendChild(sugg);
  }

  const input = $('#search');
  const doSearch = debounce(async (q) => {
    if(!q) { sugg.classList.add('hidden'); return; }
    // local cache
    if(CACHE.search[q]) {
      renderSearchSuggestions(CACHE.search[q], sugg);
      return;
    }
    try {
      const data = await fetchJson(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(q)}&page=1&include_adult=false`);
      const results = (data.results || []).slice(0,10);
      CACHE.search[q] = results;
      renderSearchSuggestions(results, sugg);
    } catch(e) {
      console.warn('search error', e);
      sugg.classList.add('hidden');
    }
  }, 260);

  input.addEventListener('input', (e)=> doSearch(e.target.value.trim()));
  document.addEventListener('click', (e) => {
    if(!e.target.closest('#search') && !e.target.closest('#search-suggestions')) {
      sugg.classList.add('hidden');
    }
  });
}

function renderSearchSuggestions(results, container){
  container.innerHTML = '';
  if(!results.length){ container.classList.add('hidden'); return; }
  for(const r of results){
    const row = createEl('div','sugg-row');
    row.style.padding = '8px 12px';
    row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
    row.style.cursor = 'pointer';
    const title = r.title || r.name || r.original_name || 'Untitled';
    const sub = r.media_type ? r.media_type.toUpperCase() : 'ITEM';
    row.innerHTML = `<div style="font-weight:700">${title}</div><div style="opacity:0.7;font-size:13px">${sub} • ${r.vote_average ? r.vote_average : ''}</div>`;
    row.onclick = () => {
      // open modal detail for suggestion
      openDetail(r);
      container.classList.add('hidden');
    };
    container.appendChild(row);
  }
  container.classList.remove('hidden');
}

/* ---------- BOOTSTRAP ---------- */

async function init(){
  showSkeletonRows();
  attachModalHandlers();
  attachSearchBox();

  try {
    // parallel fetch rows
    const promises = ROWS.map(r => fetchJson(r.url).then(d => ({...r, data:d})).catch(e => ({...r, data:null, err:e})));
    const rowsData = await Promise.all(promises);

    // hero items: trending results
    const trending = rowsData.find(r => r.id === 'trending');
    if(trending && trending.data && trending.data.results && trending.data.results.length){
      startHeroSlideshow(trending.data.results.slice(0,8)); // keep first 8
    }

    // render rows
    await renderRows(rowsData);
  } catch(e){
    console.error('init error', e);
    clearRowsAndShowMessage('Could not load rows. Try refreshing or run a local server if you face CORS.');
  }
}

document.addEventListener('DOMContentLoaded', init);


window.addEventListener("hashchange", loadRoute);
window.addEventListener("load", loadRoute);

