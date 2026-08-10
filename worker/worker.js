const ALLOWED_HOST = 'www.drivehubler.com';
const VALID_LOCATIONS = ['Shelbyville', 'Rushville', 'Indianapolis', 'Greenwood', 'Taylorsville', 'Bedford'];

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method === 'GET') return json({ ok: true, service: 'Hubler Marketplace Importer' }, cors);
    if (request.method !== 'POST') return json({ ok: false, error: 'POST required.' }, cors, 405);
    try {
      const body = await request.json();
      const url = String(body.url || '').trim();
      if (!isAllowedUrl(url)) throw new Error('Only DriveHubler vehicle URLs are allowed.');
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        }
      });
      if (!response.ok) throw new Error(`DriveHubler returned HTTP ${response.status}.`);
      const html = await response.text();
      return json({ ok: true, vehicle: parseVehicle(html, url) }, cors);
    } catch (err) {
      return json({ ok: false, error: err && err.message ? err.message : String(err) }, cors, 400);
    }
  }
};

function json(data, headers, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json;charset=UTF-8' }
  });
}

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === ALLOWED_HOST && /\/used-/i.test(u.pathname);
  } catch (e) { return false; }
}

function parseVehicle(html, url) {
  const title = getTitle(html, url);
  const price = getPrice(html);
  const mileage = getById(html, 'data-odometer');
  const color = getById(html, 'data-dotagging-item-color');
  const location = getCityFromUrl(url);
  const vin = getVin(html, url);
  const photos = getGalleryPhotos(html, url);
  return {
    url: url,
    title: title,
    marketplaceTitle: title,
    price: price,
    mileage: formatMileage(mileage),
    location: location,
    color: color,
    vin: vin,
    description: makeDescription(title, price, mileage, location, color),
    photos: photos
  };
}

function getTitle(html, url) {
  const og = firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
  if (og) return clean(og);
  const h1 = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return clean(h1);
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? clean(title) : titleFromUrl(url);
}

function getPrice(html) {
  const patterns = [
    /(?:Sale Price|Internet Price|Our Price|Price)[^$\d]{0,80}\$\s*([\d,]{4,7})/i,
    /\$([\d,]{4,7})/
  ];
  for (const pattern of patterns) {
    const value = firstMatch(html, pattern);
    if (value) return '$' + value.replace(/\$/g, '');
  }
  return '';
}

function getById(html, id) {
  const escaped = escapeRegExp(id);
  const elementPattern = new RegExp('<[^>]*\\bid=["\\\']' + escaped + '["\\\'][^>]*>([\\s\\S]*?)<\\/[^>]+>', 'i');
  const element = html.match(elementPattern);
  if (element && element[1]) return clean(element[1]);
  const valuePattern = new RegExp('<[^>]*\\bid=["\\\']' + escaped + '["\\\'][^>]*\\b(?:value|content)=["\\\']([^"\\\']+)["\\\']', 'i');
  const value = html.match(valuePattern);
  if (value && value[1]) return clean(value[1]);
  return '';
}

function getGalleryPhotos(html, baseUrl) {
  const photos = [];
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const id = `gallery--thumbnail--desktop--${i}`;
    const escapedId = escapeRegExp(id);
    const tagPattern = new RegExp('<(?:img|a|source)[^>]*\\bid=["\\\']' + escapedId + '["\\\'][^>]*>', 'i');
    const tag = html.match(tagPattern);
    if (!tag) continue;
    const imageUrl = getImageUrl(tag[0], baseUrl);
    if (imageUrl && !seen.has(imageUrl)) {
      seen.add(imageUrl);
      photos.push(imageUrl);
    }
  }
  return photos;
}

function getImageUrl(tag, baseUrl) {
  const patterns = [
    /data-full-src=["']([^"']+)["']/i,
    /data-image=["']([^"']+)["']/i,
    /data-src=["']([^"']+)["']/i,
    /data-original=["']([^"']+)["']/i,
    /src=["']([^"']+)["']/i,
    /srcset=["']([^"']+)["']/i,
    /href=["']([^"']+)["']/i
  ];
  for (const pattern of patterns) {
    const match = tag.match(pattern);
    if (!match || !match[1]) continue;
    const candidate = match[1].split(',')[0].trim().split(/\s+/)[0].replace(/&amp;/g, '&');
    if (!candidate || candidate.indexOf('data:') === 0) continue;
    try { return new URL(candidate, baseUrl).toString(); } catch (e) {}
  }
  return '';
}

function getVin(html, url) {
  const fromPage = firstMatch(html, /(?:Vehicle Identification Number|VIN)[^A-Z0-9]{0,80}([A-HJ-NPR-Z0-9]{17})/i);
  if (fromPage) return fromPage;
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    const match = last.match(/([A-HJ-NPR-Z0-9]{17})$/i);
    return match ? match[1] : '';
  } catch (e) { return ''; }
}

function getCityFromUrl(url) {
  try {
    const part = new URL(url).pathname.split('/')[1] || '';
    const cleaned = part.replace(/^used-/i, '').replace(/[-+]/g, ' ').trim();
    for (const city of VALID_LOCATIONS) {
      if (cleaned.toLowerCase().indexOf(city.toLowerCase()) === 0) return city;
    }
    return 'Indiana';
  } catch (e) { return 'Indiana'; }
}

function titleFromUrl(url) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return last.replace(/^used-[^-]+-/i, '').replace(/[+\-]+/g, ' ').trim();
  } catch (e) { return 'Vehicle'; }
}

function makeDescription(title, price, mileage, location, color) {
  const lines = [title || 'Vehicle'];
  lines.push('Sale Price: ' + (price || 'Call for price'));
  if (mileage) lines.push(formatMileage(mileage));
  if (location) lines.push(location);
  if (color) lines.push('Color: ' + color);
  lines.push('');
  lines.push('-Great condition');
  lines.push('-Carfax history available');
  lines.push('-Financing available for all credit types.');
  lines.push('');
  lines.push('Message me to schedule your test drive');
  return lines.join('\n');
}

function formatMileage(value) {
  if (!value) return '';
  const cleaned = String(value).replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned).toLocaleString('en-US') + ' miles' : clean(value);
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match && match[1] ? match[1] : '';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clean(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
