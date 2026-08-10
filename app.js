const API_URL = 'PASTE_CLOUDFLARE_WORKER_URL_HERE';

const $ = id => document.getElementById(id);
let currentVehicle = null;

function setStatus(message, type='') {
  $('status').textContent = message;
  $('status').className = `status ${type}`;
}

function listingText() {
  return `Title: ${$('title').value}\nPrice: ${$('price').value}\nMileage: ${$('mileage').value}\nLocation: ${$('location').value}\nVIN: ${$('vin').value}\nStock #: ${$('stock').value}\n\n${$('description').value}`;
}

function renderPhotos(photos=[]) {
  const box = $('photos');
  box.innerHTML = '';
  photos.forEach((url, i) => {
    const item = document.createElement('div');
    item.className = 'photo selected';
    item.innerHTML = `<label><input type="checkbox" checked data-photo-index="${i}"></label><img src="${escapeAttr(url)}" alt="Vehicle photo ${i+1}" loading="lazy"><a href="${escapeAttr(url)}" target="_blank" rel="noopener">Open photo ${i+1}</a>`;
    box.appendChild(item);
    const cb = item.querySelector('input');
    cb.addEventListener('change', () => item.classList.toggle('selected', cb.checked));
  });
  $('photoCount').textContent = `${photos.length} photos`;
}

function escapeAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function fillVehicle(v) {
  currentVehicle = v;
  $('vehicleHeading').textContent = v.title || 'Vehicle';
  $('vinBadge').textContent = v.vin || 'VIN unavailable';
  $('title').value = v.marketplaceTitle || v.title || '';
  $('price').value = v.price || '';
  $('mileage').value = v.mileage || '';
  $('location').value = v.location || 'Greenwood, IN';
  $('stock').value = v.stock || '';
  $('vin').value = v.vin || '';
  $('description').value = v.description || '';
  renderPhotos(v.photos || []);
  $('editor').classList.remove('hidden');
  $('photosCard').classList.remove('hidden');
}

async function importVehicle() {
  const url = $('vehicleUrl').value.trim();
  if (!url) return setStatus('Paste a DriveHubler vehicle URL first.', 'error');
  if (API_URL.includes('PASTE_')) return setStatus('The Cloudflare Worker URL has not been configured yet. Deploy the worker, then paste its URL into app.js.', 'error');
  $('importBtn').disabled = true;
  setStatus('Importing vehicle information...');
  try {
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Import failed.');
    fillVehicle(data.vehicle);
    setStatus('Vehicle imported successfully.', 'ok');
  } catch (err) {
    setStatus(err.message || 'Failed to fetch the vehicle. Check the Worker URL and deployment.', 'error');
  } finally { $('importBtn').disabled = false; }
}

$('importBtn').addEventListener('click', importVehicle);
$('vehicleUrl').addEventListener('keydown', e => { if(e.key === 'Enter') importVehicle(); });
$('copyBtn').addEventListener('click', async () => { await navigator.clipboard.writeText(listingText()); setStatus('Listing copied to clipboard.', 'ok'); });
$('openMarketplaceBtn').addEventListener('click', () => window.open('https://www.facebook.com/marketplace/create/vehicle','_blank','noopener'));
$('saveBtn').addEventListener('click', () => {
  const saved = JSON.parse(localStorage.getItem('hublerMarketplaceVehicles') || '[]');
  const record = {...currentVehicle, marketplaceTitle:$('title').value, price:$('price').value, mileage:$('mileage').value, location:$('location').value, stock:$('stock').value, vin:$('vin').value, description:$('description').value, savedAt:new Date().toISOString()};
  const key = record.vin || record.url;
  const filtered = saved.filter(x => (x.vin || x.url) !== key);
  filtered.unshift(record);
  localStorage.setItem('hublerMarketplaceVehicles', JSON.stringify(filtered.slice(0,100)));
  renderSaved();
  setStatus('Vehicle saved in this browser.', 'ok');
});

function renderSaved(){
  const list = JSON.parse(localStorage.getItem('hublerMarketplaceVehicles') || '[]');
  $('savedVehicles').innerHTML = list.length ? list.map((v,i)=>`<div class="saved-item"><div><strong>${escapeAttr(v.marketplaceTitle || v.title || 'Vehicle')}</strong><small>${escapeAttr(v.vin || '')}</small></div><button data-load="${i}">Load</button></div>`).join('') : '<p class="muted">No vehicles saved yet.</p>';
  list.forEach((_,i)=>document.querySelector(`[data-load="${i}"]`)?.addEventListener('click',()=>fillVehicle(list[i])));
}
renderSaved();
