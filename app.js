// app.js — loads local mock data and renders UI
const API_MOCK = 'const API_MOCK = `https://api.themoviedb.org/3/movie/popular?api_key=63c62d92d97c823fcf668b74693bf705&language=en-US&page=1`;
'; // change to TMDB endpoint when you have an api_key

// image base like TMDB
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'; // same usage when using TMDB real data

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

async function fetchData(){
  try {
    const res = await fetch(API_MOCK);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('fetch error', err);
    return null;
  }
}

function setHero(item){
  if(!item) return;
  $('#hero-title').textContent = item.title;
  $('#hero-overview').textContent = item.overview;
  $('#hero-img').src = item.poster_path ? (IMG_BASE + item.poster_path) : '';
  $('#play-btn').onclick = () => openModal(item);
  $('#info-btn').onclick = () => openModal(item);
}

function createCard(item){
  const div = document.createElement('div');
  div.className = 'card';
  const img = document.createElement('img');
  img.alt = item.title;
  img.src = item.poster_path ? (IMG_BASE + item.poster_path) : '';
  div.appendChild(img);
  div.addEventListener('click', () => openModal(item));
  return div;
}

function openModal(item){
  const modal = $('#modal');
  const body = $('#modal-body');
  body.innerHTML = `
    <img src="${item.poster_path? IMG_BASE + item.poster_path : ''}" alt="${item.title}" />
    <h3>${item.title}</h3>
    <p><strong>Rating:</strong> ${item.vote_average || 'N/A'}</p>
    <p>${item.overview}</p>
    <div style="clear:both"></div>
  `;
  modal.classList.remove('hidden');
}

function closeModal(){
  $('#modal').classList.add('hidden');
}

function renderRows(data){
  const rows = $('#rows');
  rows.innerHTML = '';
  for(const row of data.rows){
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    const h2 = document.createElement('h2');
    h2.textContent = row.title;
    rowEl.appendChild(h2);
    const rc = document.createElement('div');
    rc.className = 'row-cards';
    for(const item of row.items){
      rc.appendChild(createCard(item));
    }
    rowEl.appendChild(rc);
    rows.appendChild(rowEl);
  }
}

async function init(){
  const data = await fetchData();
  if(!data) return;
  // pick a hero from first row first item
  const heroItem = data.rows[0].items[2] || data.rows[0].items[0];
  setHero(heroItem);
  renderRows(data);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  $('#modal-close').onclick = closeModal;
  $('#modal').addEventListener('click', (e) => {
    if(e.target === $('#modal')) closeModal();
  });

  // Search (simple filter)
  $('#search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.row .card').forEach(card => {
      const alt = card.querySelector('img').alt.toLowerCase();
      card.style.display = alt.includes(q) ? '' : 'none';
    });
  });
});
