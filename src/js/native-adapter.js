/* LucidRank web (PWA): platform adapter.
   The shared desktop frontend (core.js, main.js, checkin.js, lineups.js) talks to the Rust side through
   window.__TAURI__.core.invoke(cmd,args) and window.__TAURI__.event.listen(ev,fn). This file implements that
   same small surface in the browser, so the shared files run unchanged:
     - file storage   -> IndexedDB (falls back to localStorage), same JSON shape as lucidrank-data.json
     - screenshots    -> <input type=file>, stored as a small JPEG in IndexedDB; the match keeps a string ref
     - windows        -> full-screen in-page sheets (main.js's in-window mode)
     - game detection -> none (always "no game")
   Must load before core.js. */
(function(){
'use strict';
const VERSION='0.1.6';
const native=window.__TAURI__,nativeInvoke=native.core.invoke.bind(native.core);
let selected=Promise.resolve();
const DB_NAME='lucidrank', DATA_KEY='data', SHOT_PREFIX='lrshot:';
const LS_DATA='lr-web-data', LS_SHOT='lr-web-shot-';
let accountId=localStorage.getItem('lr-account-id')||'';const dataKey=()=>accountId?'data:'+accountId:'data';const shotKey=id=>(accountId?accountId+':':'')+id;const lsKey=k=>k==='data'?LS_DATA:LS_DATA+':'+k;

/* ---------------- tiny IndexedDB key-value wrapper (with localStorage fallback) ---------------- */
let dbP=null;
function openDB(){
  if(dbP) return dbP;
  dbP=new Promise((res,rej)=>{
    if(!('indexedDB' in window)) return rej(new Error('no indexedDB'));
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); if(!db.objectStoreNames.contains('shots')) db.createObjectStore('shots'); };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); r.onblocked=()=>rej(new Error('blocked'));
  }).catch(e=>{ console.warn('IndexedDB unavailable, using localStorage',e); return null; });
  return dbP;
}
function tx(store,mode,fn){
  return openDB().then(db=>{
    if(!db) return fn(null);
    return new Promise((res,rej)=>{
      const t=db.transaction(store,mode), s=t.objectStore(store); let out;
      const r=fn(s); if(r&&'onsuccess' in r) r.onsuccess=()=>{ out=r.result; };
      t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error);
    });
  });
}
const browserKV={
  get:k=>tx('kv','readonly',s=>s?s.get(k):(()=>{ throw 0; })()).catch(()=>{ try{ return JSON.parse(localStorage.getItem(lsKey(k))||'null'); }catch(e){ return null; } }),
  set:(k,v)=>tx('kv','readwrite',s=>{ if(!s) throw 0; return s.put(v,k); }).catch(()=>localStorage.setItem(lsKey(k),JSON.stringify(v))),
  del:k=>tx('kv','readwrite',s=>{ if(!s) throw 0; return s.delete(k); }).catch(()=>localStorage.removeItem(lsKey(k))),
};
const kv={
 get:async key=>{await selected;if(key==='data')return nativeInvoke('load_guest_data');if(key===dataKey())return nativeInvoke('load_data');return nativeInvoke('account_meta',{key,write:false});},
 set:async(key,value)=>{await selected;if(key===dataKey())return nativeInvoke('save_data',{data:value});return nativeInvoke('account_meta',{key,value,write:true});},
 del:async key=>{await selected;if(key===dataKey())return nativeInvoke('delete_all_data');return nativeInvoke('account_meta',{key,value:null,write:true});}
};
const shots={
  get:id=>tx('shots','readonly',s=>{ if(!s) throw 0; return s.get(shotKey(id)); }).catch(()=>localStorage.getItem(LS_SHOT+shotKey(id))),
  put:(id,v)=>tx('shots','readwrite',s=>{ if(!s) throw 0; return s.put(v,shotKey(id)); }).catch(()=>localStorage.setItem(LS_SHOT+shotKey(id),v)),
  del:id=>tx('shots','readwrite',s=>{ if(!s) throw 0; return s.delete(shotKey(id)); }).catch(()=>localStorage.removeItem(LS_SHOT+shotKey(id))),
  keys:()=>tx('shots','readonly',s=>{ if(!s) throw 0; return s.getAllKeys(); }).catch(()=>Object.keys(localStorage).filter(k=>k.startsWith(LS_SHOT)).map(k=>k.slice(LS_SHOT.length))),
  clear:async()=>{for(const id of await shots.keys())await shots.del(id);},
};

/* ---------------- screenshots ---------------- */
// A match stores shot = "lrshot:<id>/<original file name>", so the shared UI still shows a file name
// (it takes the part after the last slash) and we can find the thumbnail by id.
const shotId=ref=>typeof ref==='string'&&ref.startsWith(SHOT_PREFIX)?ref.slice(SHOT_PREFIX.length).split('/')[0]:null;
const allShotKeys=shots.keys;shots.keys=async()=>{const prefix=accountId?accountId+':':'';return (await allShotKeys()).filter(k=>prefix?k.startsWith(prefix):!k.includes(':')).map(k=>prefix?k.slice(prefix.length):k);};
const pending=new Set(); // picked but not saved yet: never garbage-collect these
const MAX_SIDE=640, QUALITY=.72;
function loadImage(file){
  return new Promise((res,rej)=>{ const u=URL.createObjectURL(file), im=new Image(); im.onload=()=>{ URL.revokeObjectURL(u); res(im); }; im.onerror=()=>{ URL.revokeObjectURL(u); rej(new Error('bad image')); }; im.src=u; });
}
async function thumb(file){
  const im=await loadImage(file);
  const k=Math.min(1,MAX_SIDE/Math.max(im.naturalWidth,im.naturalHeight));
  const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(im.naturalWidth*k)); c.height=Math.max(1,Math.round(im.naturalHeight*k));
  const g=c.getContext('2d'); g.fillStyle='#000'; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',QUALITY);
}
// Must stay synchronous up to input.click() so it runs inside the user's tap (iOS requires that).
function pickScreenshot(){
  return new Promise(res=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.style.display='none';
    document.body.appendChild(inp);
    const done=v=>{ inp.remove(); res(v); };
    inp.addEventListener('cancel',()=>done(null));
    inp.addEventListener('change',async()=>{
      const f=inp.files&&inp.files[0]; if(!f) return done(null);
      try{
        const url=await thumb(f), id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
        await shots.put(id,url); pending.add(id);
        const name=(f.name||'screenshot.jpg').replace(/[\\/]/g,'_').slice(-60);
        done(SHOT_PREFIX+id+'/'+name);
      }catch(e){ console.error(e); done(null); }
    });
    inp.click();
  });
}
let gcT=0;
function gcShots(data){
  clearTimeout(gcT);
  gcT=setTimeout(async()=>{
    const used=new Set((data.matches||[]).map(m=>shotId(m.shot)).filter(Boolean));
    for(const k of await shots.keys()) if(!used.has(k)&&!pending.has(k)) await shots.del(k);
  },1500);
}

/* ---------------- events (other tabs via BroadcastChannel) ---------------- */
const listeners={};
const bc='BroadcastChannel' in window?new BroadcastChannel('lucidrank'):null;
if(bc) bc.onmessage=e=>{if(e.data.accountId===accountId)emit(e.data.ev,e.data.payload);};
function emit(ev,payload){ (listeners[ev]||[]).slice().forEach(fn=>{ try{ fn({event:ev,payload}); }catch(e){ console.error(e); } }); }

/* ---------------- export / import ---------------- */
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
async function exportPayload(){
  const data=(await kv.get(dataKey()))||{};
  const out=JSON.parse(JSON.stringify(data)); delete out.webShots;
  const ws={};
  for(const m of out.matches||[]){ const id=shotId(m.shot); if(id){ const v=await shots.get(id); if(v) ws[id]=v; } }
  if(Object.keys(ws).length) out.webShots=ws; // extra key: the desktop app keeps it untouched and ignores it
  return out;
}
function stamp(){ const d=new Date(), p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`; }
async function exportData(){
  const name=`lucidrank-export-${stamp()}.json`;
  const blob=new Blob([JSON.stringify(await exportPayload(),null,2)],{type:'application/json'});
  if(isIOS&&navigator.canShare){
    try{ const file=new File([blob],name,{type:'application/json'}); if(navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:name}); return name; } }
    catch(e){ if(e&&e.name==='AbortError') return null; }
  }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000);
  return name;
}

/* ---------------- the command table (same names as src-tauri/src/lib.rs) ---------------- */
const cmds={
  load_data:async()=>{if(window.LRAccount){await LRAccount.ready;await LRAccount.restoring;}return (await kv.get(dataKey()))||{};},
  save_data:async({data})=>{ const clean=JSON.parse(JSON.stringify(data)); await kv.set(dataKey(),clean); gcShots(clean); if(window.LRAccount)await LRAccount.changed();
    (clean.matches||[]).forEach(m=>{ const id=shotId(m.shot); if(id) pending.delete(id); });
    if(bc) bc.postMessage({accountId,ev:'data-changed',payload:{from:'other'}}); return null; },
  data_location:()=>nativeInvoke('data_location'),
  delete_all_data:async()=>{ await kv.del(dataKey()); await shots.clear(); pending.clear();if(window.LRAccount)await LRAccount.changed(); if(bc) bc.postMessage({accountId,ev:'data-changed',payload:{from:'delete'}}); return null; },
  export_data:async()=>nativeInvoke('export_data',{data:await exportPayload()}),
  pick_screenshot:()=>pickScreenshot(),

};
function invoke(cmd,args){
  const f=cmds[cmd]; if(!f)return selected.then(()=>nativeInvoke(cmd,args||{}));
  try{ return Promise.resolve(f(args||{})); }catch(e){ return Promise.reject(e); }
}
function listen(ev,fn){ (listeners[ev]=listeners[ev]||[]).push(fn); return Promise.resolve(()=>{ listeners[ev]=(listeners[ev]||[]).filter(x=>x!==fn); }); }

window.__TAURI__={...native,core:{...native.core,invoke},event:{...native.event,listen:async(ev,fn)=>{const local=await listen(ev,fn);const remote=await native.event.listen(ev,fn);return()=>{local();remote();};}}};
window.LRWeb={get accountId(){return accountId;},dataKey,setAccount:id=>{clearTimeout(gcT);accountId=id||'';selected=nativeInvoke('account_select',{account:accountId});if(accountId)localStorage.setItem('lr-account-id',accountId);else localStorage.removeItem('lr-account-id');},request:async(url,options={})=>{const path=String(url).replace(/^\/api\//,'');const response=await nativeInvoke('account_request',{path,method:options.method||'GET',body:options.body?JSON.parse(options.body):null,account:accountId||null});return new Response(JSON.stringify(response.body),{status:response.status});},version:VERSION,isIOS,shots,shotId,kv,exportPayload,emit,SHOT_PREFIX};
selected=nativeInvoke('account_select',{account:accountId});
window.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.website-back,.toolbar-brand,#developer-open').forEach(link=>link.onclick=e=>{e.preventDefault();nativeInvoke('open_website',{page:link.id==='developer-open'?'developer':'home'});});});
})();
