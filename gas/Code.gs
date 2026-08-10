const ALLOWED_HOST = 'www.drivehublerpreowned.com';

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok:true, service:'Hubler Marketplace Importer'})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const url = String(body.url || '').trim();
    if (!isAllowedUrl_(url)) throw new Error('Only DriveHubler Pre-Owned vehicle URLs are allowed.');

    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions:true,
      followRedirects:true,
      headers:{'User-Agent':'Mozilla/5.0 (compatible; HublerMarketplaceTool/1.0)'}
    });
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) throw new Error('DriveHubler returned HTTP ' + code + '.');

    const html = response.getContentText();
    const vehicle = parseVehicle_(html, url);
    return json_( {ok:true, vehicle:vehicle} );
  } catch(err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function isAllowedUrl_(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === ALLOWED_HOST && /\/used-/i.test(u.pathname);
  } catch(e) { return false; }
}

function parseVehicle_(html, url) {
  const text = clean_(html);
  const title = first_(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  ]) || titleFromUrl_(url);

  const price = first_(html, [
    /(?:askingPrice|price|salePrice)[^\d]{0,80}(?:\$|&dollar;)?([\d,]{4,7})/i,
    /\$([\d,]{4,7})/
  ]);
  const vin = first_(html, [/(?:VIN|vin)[^A-Z0-9]{0,50}([A-HJ-NPR-Z0-9]{17})/i, /\b([A-HJ-NPR-Z0-9]{17})\b/]);
  const stock = first_(html, [/(?:Stock|stockNumber|stock #)[^A-Z0-9]{0,50}([A-Z0-9-]{4,15})/i]);
  const mileage = first_(html, [/(?:Mileage|mileage)[^\d]{0,50}([\d,]{2,7})/i, /([\d,]{2,7})\s*miles?/i]);
  const year = first_(html, [/\b(20(?:2[0-9]|1[0-9]))\s+(?:Chrysler|Ford|Toyota|Honda|Chevrolet|Nissan|GMC|Buick|Acura|Mazda|Jeep|Ram|Dodge|Hyundai|Kia|Subaru|Volkswagen|BMW|Mercedes-Benz|Audi|Lexus|Cadillac|Lincoln|Volvo|Tesla)\b/i]);

  const photos = extractImages_(html, url);
  const description = makeDescription_(title, price, mileage, vin, stock, text, url);

  return {
    url:url,
    title:decode_(strip_(title)),
    marketplaceTitle:decode_(strip_(title)),
    price:price ? '$' + price : '',
    mileage:mileage ? mileage + ' miles' : '',
    location:'Greenwood, IN',
    stock:stock || '',
    vin:vin || '',
    year:year || '',
    description:description,
    photos:photos
  };
}

function extractImages_(html, baseUrl) {
  const out=[]; const seen={};
  const re=/<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while((m=re.exec(html)) && out.length<60){
    let u=m[1].replace(/&amp;/g,'&');
    if(!/^https?:\/\//i.test(u)) u=resolve_(u,baseUrl);
    if(/^https:\/\//i.test(u) && /drivehublerpreowned\.com/i.test(u) && !seen[u]) { seen[u]=1; out.push(u); }
  }
  return out;
}

function resolve_(path,base){
  try{return new URL(path,base).toString();}catch(e){return path;}
}
function clean_(html){return decode_(strip_(html).replace(/\s+/g,' ').trim());}
function strip_(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function decode_(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function first_(html,patterns){for(const p of patterns){const m=html.match(p);if(m&&m[1])return strip_(m[1]);}return '';}
function titleFromUrl_(url){try{return decodeURIComponent(new URL(url).pathname.split('/').pop().replace(/^used-[^-]+-/i,'').replace(/-/g,' '));}catch(e){return 'Vehicle';}}
function makeDescription_(title,price,mileage,vin,stock,text,url){
  const lines=[];
  lines.push(title || 'Vehicle');
  if(price) lines.push('Hubler Price: $'+price);
  if(mileage) lines.push(mileage+' miles');
  if(vin) lines.push('VIN: '+vin);
  if(stock) lines.push('Stock #: '+stock);
  lines.push('');
  lines.push('View full vehicle details and photos:');
  lines.push(url);
  return lines.join('\n');
}
