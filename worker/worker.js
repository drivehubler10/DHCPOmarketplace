const ALLOWED_HOST = 'www.drivehubler.com';

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') return new Response(null, {headers:cors});
    if (request.method === 'GET') return json({ok:true, service:'Hubler Marketplace Importer'}, cors);
    if (request.method !== 'POST') return json({ok:false,error:'POST required.'}, cors, 405);

    try {
      const body = await request.json();
      const url = String(body.url || '').trim();
      if (!isAllowedUrl(url)) throw new Error('Only DriveHubler vehicle URLs are allowed.');

      const response = await fetch(url, {
        redirect: 'follow',
        headers: {'User-Agent':'Mozilla/5.0 (compatible; HublerMarketplaceTool/1.0)'}
      });
      if (!response.ok) throw new Error(`DriveHubler returned HTTP ${response.status}.`);

      const html = await response.text();
      const vehicle = parseVehicle(html, url);
      return json({ok:true, vehicle}, cors);
    } catch (err) {
      return json({ok:false,error:err?.message || String(err)}, cors, 400);
    }
  }
};

function json(data, headers, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{...headers,'Content-Type':'application/json;charset=UTF-8'}});
}

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === ALLOWED_HOST && /\/used-/i.test(u.pathname);
  } catch { return false; }
}

function parseVehicle(html, url) {
  const title = first(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  ]) || titleFromUrl(url);

  const price = first(html, [
    /(?:askingPrice|price|salePrice)[^\d]{0,80}(?:\$|&dollar;)?([\d,]{4,7})/i,
    /\$([\d,]{4,7})/
  ]);
  const vin = first(html, [
    /(?:VIN|vin)[^A-Z0-9]{0,50}([A-HJ-NPR-Z0-9]{17})/i,
    /\b([A-HJ-NPR-Z0-9]{17})\b/
  ]);
  const stock = first(html, [/(?:Stock|stockNumber|stock #)[^A-Z0-9]{0,50}([A-Z0-9-]{4,15})/i]);
  const mileage = first(html, [/(?:Mileage|mileage)[^\d]{0,50}([\d,]{2,7})/i, /([\d,]{2,7})\s*miles?/i]);
  const location = first(html, [/(?:Location|location)[^A-Za-z]{0,20}([A-Za-z .'-]{3,40})/i]) || locationFromUrl(url);
  const photos = extractImages(html, url);

  return {
    url,
    title: clean(title),
    marketplaceTitle: clean(title),
    price: price ? '$' + price : '',
    mileage: mileage ? mileage + ' miles' : '',
    location: location || 'Indiana',
    stock: stock || '',
    vin: vin || '',
    description: makeDescription(clean(title), price, mileage, vin, stock, url),
    photos
  };
}

function extractImages(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const re = /<(?:img|source)[^>]+(?:src|data-src|data-lazy-src|data-original|srcset)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 60) {
    let raw = m[1].replace(/&amp;/g, '&');
    // srcset can contain several URLs. Use the first candidate.
    let u = raw.split(',')[0].trim().split(/\s+/)[0];
    try { u = new URL(u, baseUrl).toString(); } catch { continue; }
    if (/^https:\/\//i.test(u) && /drivehubler\.com/i.test(u) && !seen.has(u)) {
      seen.add(u); out.push(u);
    }
  }
  return out;
}

function clean(s) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeEntities(s) {
  return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}

function first(html, patterns) {
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return clean(m[1]);
  }
  return '';
}

function locationFromUrl(url) {
  try {
    const part = new URL(url).pathname.split('/')[1] || '';
    return part.replace(/^used-/i,'').replace(/-/g,' ');
  } catch { return 'Indiana'; }
}

function titleFromUrl(url) {
  try {
    const part = new URL(url).pathname.split('/').pop();
    return decodeURIComponent(part.replace(/^used-[^-]+-/i,'').replace(/-/g,' '));
  } catch { return 'Vehicle'; }
}

function makeDescription(title, price, mileage, vin, stock, url) {
  const lines = [title || 'Vehicle'];
  if (price) lines.push('Hubler Price: $' + price);
  if (mileage) lines.push(mileage + ' miles');
  if (vin) lines.push('VIN: ' + vin);
  if (stock) lines.push('Stock #: ' + stock);
  lines.push('');
  lines.push('View full vehicle details and photos:');
  lines.push(url);
  return lines.join('\n');
}
