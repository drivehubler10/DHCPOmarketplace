const ALLOWED_HOST='www.drivehubler.com';
const LOCATIONS=['Shelbyville','Rushville','Indianapolis','Greenwood','Taylorsville','Bedford'];
const IMAGE_HOSTS=['www.drivehubler.com','drivehubler.com','images.dealeron.com','cdn.dealeron.com'];

export default{async fetch(request){
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
if(request.method==='OPTIONS')return new Response(null,{headers:cors});
const ru=new URL(request.url);
if(ru.searchParams.get('action')==='image')return proxyImage(ru,cors);
if(request.method==='GET')return json({ok:true,service:'Hubler Marketplace Importer'},cors);
if(request.method!=='POST')return json({ok:false,error:'POST required.'},cors,405);
try{const body=await request.json();const url=String(body.url||'').trim();if(!allowed(url))throw new Error('Only DriveHubler vehicle URLs are allowed.');const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw new Error('DriveHubler returned HTTP '+r.status+'.');return json({ok:true,vehicle:parse(await r.text(),url)},cors);}catch(e){return json({ok:false,error:e&&e.message?e.message:String(e)},cors,400);}
}};
function json(data,headers,status){return new Response(JSON.stringify(data),{status:status||200,headers:{...headers,'Content-Type':'application/json;charset=UTF-8'}});}
function allowed(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname===ALLOWED_HOST&&/\/used-/i.test(u.pathname);}catch(e){return false;}}
async function proxyImage(ru,cors){try{const source=ru.searchParams.get('url');if(!source)return json({ok:false,error:'Missing image URL.'},cors,400);const u=new URL(source);if(!IMAGE_HOSTS.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return json({ok:false,error:'Image host is not allowed.'},cors,403);const r=await fetch(source,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)return json({ok:false,error:'Image returned HTTP '+r.status+'.'},cors,r.status);const h=new Headers(cors);h.set('Content-Type',r.headers.get('Content-Type')||'image/jpeg');h.set('Content-Disposition','attachment');return new Response(r.body,{status:200,headers:h});}catch(e){return json({ok:false,error:e.message||String(e)},cors,400);}}
function parse(html,url){const title=cleanTitle(titleOf(html,url));const price=getSalePrice(html);const mileage=field(html,'data-odometer');const color=field(html,'data-dotagging-item-color');const location=city(url);const vin=getVin(html,url);return{url,title,marketplaceTitle:title,price,mileage:formatMileage(mileage),location,color,vin,description:description(title,price,mileage,location,color,vin),photos:photos(html,url)};}
function titleOf(h,url){let m=h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);if(m)return m[1];m=h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);if(m)return m[1];m=h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);return m?m[1]:url.split('/').pop();}
function cleanTitle(v){v=clean(v);return(v.split('|')[0]||'Vehicle').trim();}
function getSalePrice(h){
const patterns=[
/(?:id|class|data-[^=]+)=["'][^"']*(?:sale[-_ ]?price|internet[-_ ]?price|our[-_ ]?price)[^"']*["'][^>]*>[\s\S]{0,300}?\$\s*([\d,]{4,7})/i,
/(?:Sale Price|Internet Price|Our Price)[^$\d]{0,150}\$\s*([\d,]{4,7})/i
];
for(const p of patterns){const m=h.match(p);if(m)return'$'+m[1];}
const candidates=[];const re=/\$\s*([\d,]{4,7})/g;let m;while((m=re.exec(h))!==null){const n=Number(m[1].replace(/,/g,''));if(n>=10000&&n<=200000)candidates.push(n);}if(candidates.length)return'$'+Math.min(...candidates).toLocaleString('en-US');return'';
}
function field(h,id){const e=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');let m=h.match(new RegExp('<[^>]*\\bid=["\\\']'+e+'["\\\'][^>]*>([\\s\\S]*?)<\\/[^>]+>','i'));if(m&&clean(m[1]))return clean(m[1]);m=h.match(new RegExp('<[^>]*\\bid=["\\\']'+e+'["\\\'][^>]*(?:value|content)=["\\\']([^"\\\']+)["\\\']','i'));if(m)return clean(m[1]);m=h.match(new RegExp('\\b'+e+'\\s*=\\s*["\\\']([^"\\\']+)["\\\']','i'));return m?clean(m[1]):'';}
function photos(h,base){const out=[],seen=new Set();for(let i=0;i<100;i++){const id='gallery--thumbnail--desktop--'+i,e=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=h.match(new RegExp('<[^>]*\\bid=["\\\']'+e+'["\\\'][^>]*>','i'));if(!m)continue;const u=imageUrl(m[0],base);if(u&&!seen.has(u)){seen.add(u);out.push(u);}}return out;}
function imageUrl(tag,base){const p=[/data-full-src=["']([^"']+)["']/i,/data-image=["']([^"']+)["']/i,/data-src=["']([^"']+)["']/i,/data-original=["']([^"']+)["']/i,/src=["']([^"']+)["']/i,/srcset=["']([^"']+)["']/i,/href=["']([^"']+)["']/i];for(const x of p){const m=tag.match(x);if(!m)continue;const c=m[1].split(',')[0].trim().split(/\s+/)[0].replace(/&amp;/g,'&');try{return new URL(c,base).toString();}catch(e){}}return'';}
function getVin(h,url){let m=h.match(/(?:Vehicle Identification Number|VIN)[^A-Z0-9]{0,80}([A-HJ-NPR-Z0-9]{17})/i);if(m)return m[1];m=url.match(/([A-HJ-NPR-Z0-9]{17})$/i);return m?m[1]:'';}
function city(url){try{let p=new URL(url).pathname.split('/')[1].replace(/^used-/i,'').replace(/[-+]/g,' ');for(const c of LOCATIONS)if(p.toLowerCase().startsWith(c.toLowerCase()))return c;}catch(e){}return'Indiana';}
function description(title,price,mileage,location,color,vin){const a=[title||'Vehicle','Sale Price: '+(price||'Call for price')];if(mileage)a.push(formatMileage(mileage));if(location)a.push('Located in '+location);if(color)a.push('Color: '+color);a.push('','-Great condition','-Carfax history available','-Financing available for all credit types.','','Message me to schedule your test drive');if(vin)a.push('','VIN: '+vin);return a.join('\n');}
function formatMileage(v){if(!v)return'';const n=String(v).replace(/[^0-9]/g,'');return n?Number(n).toLocaleString('en-US')+' miles':clean(v);}
function clean(v){return String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
