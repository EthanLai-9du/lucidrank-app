/* Personal lineup library. Original images stay in a dedicated local IndexedDB.
   Nothing here captures a game, recognizes a live screen, or sends input. */
(function(){
'use strict';
const {esc,t}=LR; const C=LRCatalog;
const TYPES={站位图:'stand',占位图:'stand',站位:'stand',站位圖:'stand',占位圖:'stand',瞄点图:'aim',瞄點圖:'aim',点位图:'aim',點位圖:'aim',点位:'aim',點位:'aim',效果图:'effect',效果圖:'effect',效果:'effect'};
function parseFilename(filename){
 const name=filename.split(/[\\/]/).pop();if(!/\.(png|jpe?g|webp)$/i.test(name))return null;
 const parts=name.replace(/\.[^.]+$/,'').split('-');let ordinal='',type;
 if(/^\d+$/.test(parts.at(-1))){ordinal=String(Number(parts.pop()));}
 type=TYPES[parts.pop()];if(!type||parts.length<5)return null;
 if(!ordinal&&/^\d+$/.test(parts.at(-1)))ordinal=String(Number(parts.pop()));
 if(parts.length<5)return null;const [mapRaw,agentRaw,side,area,...point]=parts;const map=C.resolveMap(mapRaw),agent=C.resolveAgent(agentRaw);
 if(!point.join('-').trim())return null;
 const key=JSON.stringify([map,agent,side,area,point.join('-'),ordinal]);
 return {key,map,agent,side,area,point:point.join('-'),ordinal,type,filename:name};
}
let dbPromise,groups=[],selected=null,tab='stand',urls=[],generation=0;
function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('lucidrank-lineups'+(window.LRWeb?.accountId?'-'+LRWeb.accountId:''),1);r.onupgradeneeded=()=>{r.result.createObjectStore('groups',{keyPath:'id'});r.result.createObjectStore('assets');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error(t('lib.storageError')));});return dbPromise;}
async function readAll(){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction('groups');const r=tx.objectStore('groups').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function asset(id){const d=await db();return new Promise((res,rej)=>{const r=d.transaction('assets').objectStore('assets').get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function save(group,images={}){const d=await db();await new Promise((res,rej)=>{const tx=d.transaction(['groups','assets'],'readwrite');tx.objectStore('groups').put(group);for(const [k,b] of Object.entries(images))tx.objectStore('assets').put(b,k);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});if(window.LRAccount)await LRAccount.changed();}
const stableId=async key=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function pick(){return new Promise(res=>{const inp=document.createElement('input');inp.type='file';inp.accept='.png,.jpg,.jpeg,.webp';inp.multiple=true;inp.onchange=()=>{res([...inp.files]);inp.remove();};inp.oncancel=()=>{res([]);inp.remove();};inp.style.display='none';document.body.appendChild(inp);inp.click();});}
async function validImage(blob){const h=new Uint8Array(await blob.slice(0,12).arrayBuffer()),str=(a,b)=>String.fromCharCode(...h.slice(a,b));if(!(h[0]===137&&str(1,4)==='PNG'||h[0]===255&&h[1]===216&&h[2]===255||str(0,4)==='RIFF'&&str(8,12)==='WEBP'))throw new Error(t('lib.badImage'));if(blob.size>8*1024*1024)throw new Error(t('lib.tooLarge'));const im=await createImageBitmap(blob);if(!im.width||!im.height){im.close();throw new Error(t('lib.badImage'));}im.close();return h[0]===137?'image/png':h[0]===255?'image/jpeg':'image/webp';}
async function importImages(){
 const files=await pick();if(!files.length)return;let accepted=0,errors=[];const existing=new Map((await readAll()).map(g=>[g.id,g]));
 for(const f of files){const p=parseFilename(f.name);if(!p){errors.push(f.name+' · '+t('lib.badName'));continue;}
  try{const mime=await validImage(f);const original=new Blob([f],{type:mime});const id=await stableId(p.key);const g=existing.get(id)||{id,key:p.key,map:p.map,agent:p.agent,side:p.side,area:p.area,point:p.point,ordinal:p.ordinal,images:{},charge:null,bounces:null,verified:false};const aid=id+'-'+p.type;g.images[p.type]=aid;await save(g,{[aid]:original});existing.set(id,g);accepted++;}catch(e){errors.push(f.name+' · '+e.message);}
 }
 groups=await readAll();LR.toast(t('lib.imported',{n:accepted}));render();const msg=document.querySelector('#library-message');if(msg)msg.textContent=errors.join('\n');
}
function release(){for(const u of urls)URL.revokeObjectURL(u);urls=[];generation++;}
async function renderPreview(){
 release();const gen=generation,H=document.querySelector('#library-preview'),g=groups.find(g=>g.id===selected);if(!H||!g)return;
 const blob=g.images[tab]?await asset(g.images[tab]):null;if(gen!==generation||!H.isConnected)return;
 H.innerHTML=blob?`<img class="library-image" alt="${esc(t('lib.'+tab))}">`:`<p class="muted">${t('lib.missing')}</p>`;
 if(blob){const u=URL.createObjectURL(blob);urls.push(u);const im=H.querySelector('img');im.src=u;
 const anchor=tab==='aim'?g.aimPoint:tab==='stand'?g.standPoint:null;
 const hint=document.createElement('p');hint.className='muted sm';hint.textContent=t(tab==='aim'?'lib.markAim':tab==='stand'?'lib.markStand':'lib.effect');H.appendChild(hint);
 if(tab==='aim'&&anchor){const zoom=document.createElement('canvas');zoom.width=300;zoom.height=300;zoom.className='library-zoom';H.appendChild(zoom);const paint=()=>{const x=anchor.x*im.naturalWidth,y=anchor.y*im.naturalHeight;zoom.getContext('2d').drawImage(im,x-50,y-50,100,100,0,0,300,300);};im.onload=paint;if(im.complete)paint();}
 if(tab==='aim'||tab==='stand')im.onclick=async e=>{const b=im.getBoundingClientRect(),scale=Math.min(b.width/im.naturalWidth,b.height/im.naturalHeight),width=im.naturalWidth*scale,height=im.naturalHeight*scale,x=(e.clientX-b.left-(b.width-width)/2)/width,y=(e.clientY-b.top-(b.height-height)/2)/height;if(x<0||x>1||y<0||y>1)return;const fresh=(await readAll()).find(x=>x.id===selected);if(!fresh)return;fresh[tab==='aim'?'aimPoint':'standPoint']={x,y};await save(fresh);groups=await readAll();render();};}
}
function render(){
 const H=document.querySelector('#v-library');if(!H)return;release();
 const sort=new Intl.Collator(LR.lang==='sc'?'zh-CN':LR.lang==='tc'?'zh-HK':'en',{numeric:true});groups.sort((a,b)=>sort.compare(a.map+a.point+a.ordinal,b.map+b.point+b.ordinal));
 if(!groups.some(g=>g.id===selected))selected=groups[0]?.id;const g=groups.find(g=>g.id===selected),full=groups.filter(g=>['stand','aim','effect'].every(k=>g.images[k])).length;
 H.innerHTML=`<header class="vh"><div><h1>${t('lib.h')}</h1><p class="lead">${t('lib.lead')}</p></div><button class="btn primary" data-lib-import>${t('lib.import')}</button></header><div class="card"><p>${t('lib.format')}</p><p class="muted xs">${t('lib.local')}</p><p class="muted sm">${t('lib.count',{n:groups.length,full})}</p><div class="row gap wrap"><button class="btn ghost sm" data-lib-export>${t('lib.export')}</button><button class="btn ghost sm" data-lib-restore>${t('lib.restore')}</button></div><pre class="muted xs" id="library-message" aria-live="polite"></pre></div>
 <div class="library-grid"><div class="card library-list">${groups.length?groups.map(x=>`<button class="lcard${x.id===selected?' on':''}" data-lib-select="${x.id}"><b>${esc(x.point)}${x.ordinal?' · '+esc(x.ordinal):''}</b><span class="muted sm">${esc(C.mapName(x.map))} · ${esc(C.agentName(x.agent))} · ${esc(x.side)} · ${esc(x.area)}</span><span class="muted xs">${['stand','aim','effect'].filter(k=>x.images[k]).map(k=>t('lib.'+k)).join(' / ')}</span></button>`).join(''):`<p class="muted">${t('lib.empty')}</p>`}</div>
 ${g?`<div class="card"><div class="seg">${['stand','aim','effect'].map(k=>`<button data-lib-tab="${k}" aria-pressed="${k===tab}">${t('lib.'+k)}</button>`).join('')}</div><div id="library-preview"></div><div class="fgrid"><label class="lbl">${t('lib.charge')}<select data-lib-param="charge"><option value="">${t('lib.unset')}</option>${[1,2,3].map(n=>`<option value="${n}"${g.charge===n?' selected':''}>${n===3?t('lib.full'):n}</option>`).join('')}</select></label><label class="lbl">${t('lib.bounces')}<select data-lib-param="bounces"><option value="">${t('lib.unset')}</option>${[0,1,2].map(n=>`<option value="${n}"${g.bounces===n?' selected':''}>${n}</option>`).join('')}</select></label></div><p class="muted xs">${t('lib.unverified')}</p></div>`:''}</div>`;
 H.querySelector('[data-lib-import]').onclick=()=>importImages().catch(e=>LR.toast(esc(e.message)));
 H.querySelector('[data-lib-export]').onclick=()=>exportLibrary().catch(e=>LR.toast(esc(e.message)));
 H.querySelector('[data-lib-restore]').onclick=()=>restoreLibrary().catch(e=>LR.toast(esc(e.message)));
 H.querySelectorAll('[data-lib-select]').forEach(b=>b.onclick=()=>{selected=b.dataset.libSelect;render();});H.querySelectorAll('[data-lib-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.libTab;render();});
 H.querySelectorAll('[data-lib-param]').forEach(x=>x.onchange=async()=>{const fresh=(await readAll()).find(x=>x.id===selected);if(!fresh)return;fresh[x.dataset.libParam]=x.value===''?null:Number(x.value);await save(fresh);groups=await readAll();});renderPreview().catch(e=>LR.toast(esc(e.message)));
}
const dataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b);});
async function snapshot(){const list=await readAll(),images={};for(const g of list)for(const id of Object.values(g.images)){const b=await asset(id);if(b)images[id]=await dataURL(b);}return {kind:'lucidrank-lineup-library',version:1,groups:list,images};}
async function exportLibrary(){const b=new Blob([JSON.stringify(await snapshot())],{type:'application/json'}),a=document.createElement('a'),u=URL.createObjectURL(b);a.href=u;a.download='LucidRank-lineups.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);}
async function restoreLibrary(){
 const inp=document.createElement('input');inp.type='file';inp.accept='.json';const f=await new Promise(res=>{inp.onchange=()=>res(inp.files[0]);inp.oncancel=()=>res(null);inp.click();});if(!f)return;if(f.size>100*1024*1024)throw new Error(t('lib.tooLarge'));
 return restoreSnapshot(JSON.parse(await f.text()),false,true);}
async function restoreSnapshot(doc,replace=false,ask=false){if(doc.kind!=='lucidrank-lineup-library'||doc.version!==1||!Array.isArray(doc.groups)||!doc.images)throw new Error(t('lib.badBackup'));
 // Validate the whole backup before any writes.
 const planned=[];for(const g of doc.groups){if(typeof g.key!=='string'||await stableId(g.key)!==g.id||!g.images||['map','agent','side','area','point','ordinal'].some(k=>typeof g[k]!=='string')||g.charge!=null&&![1,2,3].includes(g.charge)||g.bounces!=null&&![0,1,2].includes(g.bounces))throw new Error(t('lib.badBackup'));for(const key of ['aimPoint','standPoint']){if(g[key]&&(!Number.isFinite(g[key].x)||!Number.isFinite(g[key].y)||g[key].x<0||g[key].x>1||g[key].y<0||g[key].y>1))throw new Error(t('lib.badBackup'));}const images={};for(const [k,id] of Object.entries(g.images)){const value=doc.images[id];if(!['stand','aim','effect'].includes(k)||id!==g.id+'-'+k||typeof value!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(value))throw new Error(t('lib.badBackup'));const parts=value.split(','),bytes=Uint8Array.from(atob(parts[1]),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:parts[0].slice(5).split(';')[0]});await validImage(blob);images[id]=blob;}planned.push({g,images});}
 if(ask&&!await LR.confirm(t('lib.restoreConfirm',{n:planned.length}),t('lib.restore')))return;const d=await db();await new Promise((res,rej)=>{const tx=d.transaction(['groups','assets'],'readwrite'),gs=tx.objectStore('groups'),as=tx.objectStore('assets');if(replace){gs.clear();as.clear();}for(const {g,images} of planned){gs.put(g);for(const [id,b] of Object.entries(images))as.put(b,id);}tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});groups=await readAll();render();if(window.LRAccount)await LRAccount.changed();
}
window.LRLibrary={snapshot,restoreSnapshot,setAccount:async()=>{release();if(dbPromise)(await dbPromise).close();dbPromise=null;groups=[];selected=null;},parseFilename,stableId,release,render:async()=>{try{groups=await readAll();render();}catch(e){const H=document.querySelector('#v-library');if(H)H.innerHTML=`<div class="card"><h1>${t('lib.h')}</h1><p>${esc(e.message||t('lib.storageError'))}</p></div>`;}}};
})();
