const ALLOWED_HOST = 'www.drivehubler.com';

export default {
  async fetch(request) {
    const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if (request.method === 'OPTIONS') return new Response(null,{headers:cors});
    if (request.method === 'GET') return json({ok:true,service:'Hubler Marketplace Importer',source:ALLOWED_HOST},cors);
    if (request.method !== 'POST') return json({ok:false,error:'POST required.'},cors,405);
    try {
      const body=await request.json(); const url=String(body.url||'').trim();
      if(!isAllowedUrl(url)) throw new Error('Only DriveHubler vehicle URLs are allowed.');
      const response=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'}});
      if(!response.ok) throw new Error(`DriveHubler returned HTTP ${response.status}.`);
      const vehicle=parseVehicle(await response.text(),url); return json({ok:true,vehicle},cors);
    } catch(err){return json({ok:false,error:err?.message||String(err)},cors,400);}
  }
};
function json(data,headers,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json;charset=UTF-8'}});}
function isAllowedUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname===ALLOWED_HOST&&/\/used-/i.test(u.pathname);}catch{return false;}}
function parseVehicle(html,url){
  const s=parseStructuredData(html);
  const title=s.title||first(html,[/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,/<title[^>]*>([\s\S]*?)<\/title>/i,/<h1[^>]*>([\s\S]*?)<\/h1>/i])||titleFromUrl(url);
  const price=s.price||first(html,[/(?:askingPrice|salePrice|internetPrice|vehiclePrice|price)[^\d]{0,120}(?:\$|&dollar;)?([\d,]{4,7})/i,/\$([\d,]{4,7})/]);
  const vin=s.vin||first(html,[/(?:Vehicle Identification Number|VIN)[^A-Z0-9]{0,80}([A-HJ-NPR-Z0-9]{17})/i,/\b([A-HJ-NPR-Z0-9]{17})\b/]);
  const stock=s.stock||first(html,[/(?:Stock Number|Stock #|Stock)[^A-Z0-9]{0,60}([A-Z0-9-]{4,20})/i]);
  const mileage=s.mileage||first(html,[/(?:mileage|odometer|odometerReading)[^\d]{0,100}([\d,]{2,7})\s*(?:miles|mi)?/i,/([\d,]{2,7})\s*(?:miles|mi)\b/i]);
  const location=s.location||locationFromUrl(url); const photos=unique([...s.images,...extractImages(html,url)]).slice(0,60);
  return {url,title:clean(title),marketplaceTitle:clean(title),price:price?(String(price).includes('$')?String(price):'$'+price):'',mileage:mileage?formatMileage(mileage):'',location:location||'Indiana',stock:stock||'',vin:vin||'',description:makeDescription(clean(title),price,mileage,vin,stock,url),photos};
}
function parseStructuredData(html){const r={title:'',price:'',mileage:'',vin:'',stock:'',location:'',images:[]};const blocks=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];for(const m of blocks){try{walkStructured(JSON.parse(m[1].trim()),r);}catch{}}return r;}
function walkStructured(v,r){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(x=>walkStructured(x,r));return;}const type=String(v['@type']||'').toLowerCase();if(!r.title&&(type.includes('vehicle')||type.includes('product')))r.title=v.name||'';if(!r.vin)r.vin=v.vehicleIdentificationNumber||v.vin||'';if(!r.stock)r.stock=v.sku||v.mpn||v.productID||'';if(!r.mileage){const o=v.mileageFromOdometer||v.vehicleOdometer||v.odometerReading;r.mileage=typeof o==='object'?(o?.value||o?.name||''):o||'';}if(!r.price&&v.offers){const o=Array.isArray(v.offers)?v.offers[0]:v.offers;if(o?.price!=null)r.price=o.price;}if(!r.price&&v.price!=null)r.price=v.price;if(v.image){const imgs=Array.isArray(v.image)?v.image:[v.image];imgs.forEach(x=>{if(typeof x==='string')r.images.push(x);else if(x?.url)r.images.push(x.url);});}if(!r.location&&v.address&&typeof v.address==='object')r.location=[v.address.addressLocality,v.address.addressRegion].filter(Boolean).join(', ');Object.values(v).forEach(x=>{if(x&&typeof x==='object')walkStructured(x,r);});}
function extractImages(html,base){const out=[],seen=new Set(),tags=html.match(/<(?:img|source)\b[^>]*>/gi)||[];for(const tag of tags){const attrs=[...tag.matchAll(/(?:src|data-src|data-lazy-src|data-original|data-image|data-image-url|srcset)\s*=\s*["']([^"']+)["']/gi)];for(const a of attrs){for(let u of a[1].split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean)){u=u.replace(/&amp;/g,'&');try{u=new URL(u,base).toString();}catch{continue;}if(/^https:\/\//i.test(u)&&isLikelyVehicleImage(u)&&!seen.has(u)){seen.add(u);out.push(u);}}}}return out;}
function isLikelyVehicleImage(u){return /\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(u)||/(?:vehicle|inventory|photo|image|img|dealer)/i.test(u);}
function unique(a){return[...new Set(a.filter(Boolean))];}
function formatMileage(v){const n=String(v).replace(/[^\d]/g,'');return n?Number(n).toLocaleString('en-US')+' miles':String(v);}
function clean(s){return decodeEntities(String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());}
function decodeEntities(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function first(html,patterns){for(const p of patterns){const m=html.match(p);if(m?.[1])return clean(m[1]);}return '';}
function locationFromUrl(url){try{return(new URL(url).pathname.split('/')[1]||'').replace(/^used-/i,'').replace(/-/g,' ');}catch{return'Indiana';}}
function titleFromUrl(url){try{const p=new URL(url).pathname.split('/').pop();return decodeURIComponent(p.replace(/^used-[^-]+-/i,'').replace(/-/g,' '));}catch{return'Vehicle';}}
function makeDescription(title,price,mileage,vin,stock,url){const lines=[title||'Vehicle'];if(price)lines.push('Hubler Price: '+(String(price).includes('$')?price:'$'+price));if(mileage)lines.push(formatMileage(mileage));if(vin)lines.push('VIN: '+vin);if(stock)lines.push('Stock #: '+stock);lines.push('','View full vehicle details and photos:',url);return lines.join('\n');}
