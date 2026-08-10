const ALLOWED_HOST = 'www.drivehubler.com';
const VALID_LOCATIONS = ['Shelbyville', 'Rushville', 'Indianapolis', 'Greenwood', 'Taylorsville', 'Bedford'];
const IMAGE_HOSTS = ['www.drivehubler.com', 'drivehubler.com', 'images.dealeron.com', 'cdn.dealeron.com'];

export default { async fetch(request) {
  const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if (request.method === 'OPTIONS') return new Response(null,{headers:cors});
  const reqUrl = new URL(request.url);
  if (reqUrl.searchParams.get('action') === 'image') return proxyImage(reqUrl,cors);
  if (request.method === 'GET') return json({ok:true,service:'Hubler Marketplace Importer'},cors);
  if (request.method !== 'POST') return json({ok:false,error:'POST required.'},cors,405);
  try {
    const body=await request.json(), url=String(body.url||'').trim();
    if(!isAllowedUrl(url)) throw new Error('Only DriveHubler vehicle URLs are allowed.');
    const response=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'}});
    if(!response.ok) throw new Error(`DriveHubler returned HTTP ${response.status}.`);
    return json({ok:true,vehicle:parseVehicle(await response.text(),url)},cors);
  } catch(err) { return json({ok:false,error:err?.message||String(err)},cors,400); }
}};

async function proxyImage(reqUrl,cors){
  try{
    const source=reqUrl.searchParams.get('url'); if(!source) return json({ok:false,error:'Missing image URL.'},cors,400);
    const u=new URL(source); if(!isAllowedImageHost(u.hostname)) return json({ok:false,error:'Image host is not allowed.'},cors,403);
    const response=await fetch(source,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0'}});
    if(!response.ok) return json({ok:false,error:`Image returned HTTP ${response.status}.`},cors,response.status);
    const headers=new Headers(cors); headers.set('Content-Type',response.headers.get('Content-Type')||'image/jpeg'); headers.set('Cache-Control','public,max-age=3600');
    return new Response(response.body,{status:200,headers});
  }catch(err){return json({ok:false,error:err?.message||String(err)},cors,400);}
}
function isAllowedImageHost(hostname){const h=hostname.toLowerCase();return IMAGE_HOSTS.some(x=>h===x||h.endsWith('.'+x));}
function json(data,headers,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json;charset=UTF-8'}});}
function isAllowedUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname===ALLOWED_HOST&&/\/used-/i.test(u.pathname);}catch{return false;}}
function parseVehicle(html,url){const title=cleanTitle(getTitle(html,url)),price=getPrice(html),mileage=getByIdOrDataAttribute(html,'data-odometer'),color=getByIdOrDataAttribute(html,'data-dotagging-item-color'),location=getCityFromUrl(url),vin=getVin(html,url),photos=getGalleryPhotos(html,url);return{url,title,marketplaceTitle:title,price,mileage:formatMileage(mileage),location,color,vin,description:makeDescription(title,price,mileage,location,color),photos};}
function getTitle(html,url){const og=firstMatch(html,/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);if(og)return clean(og);const h1=firstMatch(html,/<h1[^>]*>([\s\S]*?)<\/h1>/i);if(h1)return clean(h1);const t=firstMatch(html,/<title[^>]*>([\s\S]*?)<\/title>/i);return t?clean(t):titleFromUrl(url);}
function cleanTitle(v){let t=clean(v);if(t.includes('|'))t=t.split('|')[0].trim();return t.replace(/\s+/g,' ').trim();}
function getPrice(html){for(const p of [/(?:Sale Price|Internet Price|Our Price|Price)[^$\d]{0,80}\$\s*([\d,]{4,7})/i,/\$([\d,]{4,7})/]){const v=firstMatch(html,p);if(v)return '$'+v.replace(/\$/g,'');}return '';}
function getByIdOrDataAttribute(html,key){const e=escapeRegExp(key);let m=html.match(new RegExp('<[^>]*\\bid=["\\']'+e+'["\\'][^>]*>([\\s\\S]*?)<\\/[^>]+>','i'));if(m?.[1]&&clean(m[1]))return clean(m[1]);m=html.match(new RegExp('<[^>]*\\bid=["\\']'+e+'["\\'][^>]*(?:value|content)=["\\']([^"\\']+)["\\']','i'));if(m?.[1])return clean(m[1]);m=html.match(new RegExp('<[^>]*\\b'+e+'\\s*=\\s*["\\']([^"\\']+)["\\'][^>]*>','i'));if(m?.[1])return clean(m[1]);m=html.match(new RegExp('\\b'+e+'\\s*=\\s*["\\']([^"\\']+)["\\']','i'));return m?.[1]?clean(m[1]):'';}
function getGalleryPhotos(html,baseUrl){const out=[],seen=new Set();for(let i=0;i<100;i++){const id=`gallery--thumbnail--desktop--${i}`,e=escapeRegExp(id),tag=html.match(new RegExp('<[^>]*\\bid=["\\']'+e+'["\\'][^>]*>','i'));if(!tag)continue;const u=getImageUrl(tag[0],baseUrl);if(u&&!seen.has(u)){seen.add(u);out.push(u);}}return out;}
function getImageUrl(tag,base){for(const p of [/data-full-src=["']([^"']+)["']/i,/data-image=["']([^"']+)["']/i,/data-src=["']([^"']+)["']/i,/data-original=["']([^"']+)["']/i,/src=["']([^"']+)["']/i,/srcset=["']([^"']+)["']/i,/href=["']([^"']+)["']/i]){const m=tag.match(p);if(!m?.[1])continue;const c=m[1].split(',')[0].trim().split(/\s+/)[0].replace(/&amp;/g,'&');if(!c||c.startsWith('data:'))continue;try{return new URL(c,base).toString();}catch{}}return '';}
function getVin(html,url){const p=firstMatch(html,/(?:Vehicle Identification Number|VIN)[^A-Z0-9]{0,80}([A-HJ-NPR-Z0-9]{17})/i);if(p)return p;try{const m=decodeURIComponent(new URL(url).pathname.split('/').pop()||'').match(/([A-HJ-NPR-Z0-9]{17})$/i);return m?m[1]:'';}catch{return '';}}
function getCityFromUrl(url){try{const p=(new URL(url).pathname.split('/')[1]||'').replace(/^used-/i,'').replace(/[-+]/g,' ').trim();return VALID_LOCATIONS.find(x=>p.toLowerCase().startsWith(x.toLowerCase()))||'Indiana';}catch{return 'Indiana';}}
function titleFromUrl(url){try{return decodeURIComponent(new URL(url).pathname.split('/').pop()||'').replace(/^used-[^-]+-/i,'').replace(/[+\-]+/g,' ').trim();}catch{return 'Vehicle';}}
function makeDescription(title,price,mileage,location,color){const lines=[title||'Vehicle','Sale Price: '+(price||'Call for price')];if(mileage)lines.push(formatMileage(mileage));if(location)lines.push('Located in '+location);if(color)lines.push('Color: '+color);lines.push('','-Great condition','-Carfax history available','-Financing available for all credit types.','','Message me to schedule your test drive');return lines.join('\n');}
function formatMileage(v){if(!v)return '';const n=String(v).replace(/[^0-9]/g,'');return n?Number(n).toLocaleString('en-US')+' miles':clean(v);}
function firstMatch(t,p){const m=t.match(p);return m?.[1]||'';}
function escapeRegExp(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function clean(v){return decodeEntities(String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());}
function decodeEntities(v){return String(v).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
