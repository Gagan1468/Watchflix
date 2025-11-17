// app.js (module)
// Provided API key (you gave this). For production: move to server!
const TMDB_API_KEY = '63c62d92d97c823fcf668b74693bf705';

// endpoints to build rows (type, title, url)
const ROWS = [
  { id: 'trending', title: 'Trending Now', url: `https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US` },
  { id: 'top_rated', title: 'Top Rated', url: `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1` },
  { id: 'popular_tv', title: 'Popular TV', url: `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1` },
  { id: 'upcoming', title: 'Upcoming Movies', url: `https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1` },
  { id: 'now_playing', title: 'Now Playing', url: `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1` }
];

const IMG_BASE = 'https://image.tmdb.org/t/p/original'; // big images for hero
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

const $ = s => document.querySelector(s);
const createEl = (tag, cls) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};

async function fetchJson(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Network error');
  return res.json();
}

async function init(){
  try {
    // fetch rows in parallel
    const rowPromises = ROWS.map(r => fetchJson(r.url).then(d => ({...r, data: d})).catch(e => ({...r, data: null, err: e})));
    const rowsData = await Promise.all(rowPromises);

    // render hero picking a random trending item
    const trending = rowsData.find(r => r.id === 'trending');
    let heroItem = null;
    if(trending && trending.data && trending.data.results && trending.data.results.length){
      // pick the first big item with backdrop
      heroItem = trending.data.results.find(i => i.backdrop_path || i.poster_path) || trending.data.results[0];
      setHero(heroItem);
    }

    // render rows
    const container = $('#rows');
    container.innerHTML = '';
    for(const r of rowsData){
      if(!r.data || !r.data.results) continue;
      const rowEl = createEl('div','row');
      const h2 = createEl('h2'); h2.textContent = r.title;
      const cards = createEl('div','row-cards');
      r.data.results.forEach(item => {
        const card = createCard(item);
        cards.appendChild(card);
      });
      rowEl.appendChild(h2);
      rowEl.appendChild(cards);
      container.appendChild(rowEl);
    }

    attachSearch();
    attachModalHandlers();

  } catch(err){
    console.error(err);
    $('#rows').innerHTML = '<p style="color:#bbb">Could not load data. Check console.</p>';
  }
}

/* HERO */
function setHero(item){
  const title = item.title || item.name || item.original_name || 'Untitled';
  $('#hero-title').textContent = title;
  $('#hero-overview').textContent = item.overview || '';
  const backdropPath = item.backdrop_path || item.poster_path;
  if(backdropPath){
    $('#hero-backdrop').style.backgroundImage = `url(${IMG_BASE + backdropPath})`;
  }
  // attach hero buttons
  $('#hero-play').onclick = () => openDetail(item);
  $('#hero-info').onclick = () => openDetail(item);
}

/* CARD */
function createCard(item){
  const el = createEl('div','card');
  const img = createEl('img');
  img.alt = item.title || item.name || '';
  img.src = item.poster_path ? (POSTER_BASE + item.poster_path) : (item.backdrop_path ? POSTER_BASE + item.backdrop_path : '');
  el.appendChild(img);
  const meta = createEl('div','meta'); meta.textContent = (item.title || item.name || '').slice(0,32);
  el.appendChild(meta);
  el.addEventListener('click', () => openDetail(item));
  return el;
}

/* MODAL + TRAILER */
async function openDetail(item){
  const modal = $('#modal');
  const body = $('#modal-body');
  body.innerHTML = '<p style="color:#999">Loading...</p>';
  modal.classList.remove('hidden');

  // try fetch videos (both movie and tv endpoints)
  let videos = null;
  try {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const id = item.id;
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}/videos?api_key=${TMDB_API_KEY}&language=en-US`;
    const data = await fetchJson(url);
    videos = data.results || [];
  } catch(e){ console.warn('videos fetch failed', e); }

  // build modal content
  const poster = item.poster_path ? (POSTER_BASE + item.poster_path) : '';
  const title = item.title || item.name || item.original_name || '';
  const rating = item.vote_average ? `${item.vote_average}/10` : 'N/A';
  const overview = item.overview || 'No description available.';

  body.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      ${poster ? `<img src="${poster}" alt="${title}" style="width:240px;border-radius:8px">` : ''}
      <div class="info" style="flex:1;min-width:220px">
        <h3 style="margin:0 0 8px">${title}</h3>
        <p style="color:#9aa4ad;margin:0 0 10px"><strong>Rating:</strong> ${rating}</p>
        <p style="color:#b6bcc2;line-height:1.4">${overview}</p>
        <div id="modal-actions" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap"></div>
      </div>
    </div>
  `;

  const actions = $('#modal-actions');
  // Add play trailer button if there is a youtube trailer
  const youtube = videos && videos.find(v => v.site === 'YouTube' && v.type === 'Trailer');
  if(youtube){
    const btn = createEl('button','btn primary'); btn.textContent = '▶ Play Trailer';
    btn.onclick = () => openTrailer(youtube.key);
    actions.appendChild(btn);
  }
  // add open detail on TMDB
  const tmdbBtn = createEl('a','btn ghost'); tmdbBtn.textContent = 'Open on TMDB'; tmdbBtn.href = `https://www.themoviedb.org/${item.media_type || (item.title ? 'movie' : 'tv')}/${item.id}`; tmdbBtn.target = '_blank';
  actions.appendChild(tmdbBtn);
}

function openTrailer(youtubeKey){
  const modal = $('#modal');
  const body = $('#modal-body');
  // embed youtube
  body.innerHTML = `<div style="position:relative;padding-top:56.25%"><iframe src="https://www.youtube.com/embed/${youtubeKey}?autoplay=1" allow="autoplay; encrypted-media" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px"></iframe></div>`;
  modal.classList.remove('hidden');
}

function attachModalHandlers(){
  $('#modal-close').onclick = () => $('#modal').classList.add('hidden');
  $('#modal').addEventListener('click', (e) => { if(e.target === $('#modal')) $('#modal').classList.add('hidden'); });
}

/* SEARCH */
function attachSearch(){
  const search = $('#search');
  if(!search) return;
  let timeout = null;
  search.addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const q = e.target.value.trim();
      if(!q) {
        // clear filters: show all cards
        document.querySelectorAll('.row .card').forEach(c => c.style.display = '');
        return;
      }
      // simple client-side filter on card alt text
      document.querySelectorAll('.row .card').forEach(c => {
        const alt = (c.querySelector('img')?.alt || '').toLowerCase();
        c.style.display = alt.includes(q.toLowerCase()) ? '' : 'none';
      });
    }, 220);
  });
}

document.addEventListener('DOMContentLoaded', init);
