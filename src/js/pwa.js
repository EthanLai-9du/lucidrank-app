/* LucidRank web (PWA): what only the web build needs on top of the shared desktop UI.
   - Settings view for the web (install, reminders note, import/export, storage note)
   - "Add to Home Screen" hint (iOS Share sheet text / Android beforeinstallprompt), shown at most a few times
   - screenshot thumbnails in match rows + a viewer
   - Android back button / swipe closes the full-screen sheet
   - service worker registration and "new version" bar
   Loaded after main.js. */
(function(){
'use strict';
const {$,$$,esc,t,setLang,onLang,store,toast}=LR;
const root=document.documentElement;
const ua=navigator.userAgent;
const isIOS=LRWeb.isIOS, isAndroid=/Android/i.test(ua);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const SHARE_ICON='<svg class="share-i" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v10M6.5 6 10 2.5 13.5 6M6 9H4.5v8.5h11V9H14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
root.classList.add('web');
if(matchMedia('(pointer:coarse)').matches) root.classList.add('touch');
if(standalone()) root.classList.add('standalone');

/* ---------------- install state ---------------- */
let deferred=null;
const HINT_KEY='lr-web-hint', VISITS_KEY='lr-web-visits';
const ls={get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } },set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} }};
const visits=(+ls.get(VISITS_KEY)||0)+1; ls.set(VISITS_KEY,visits);
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferred=e; refreshInstall(); maybeHint(); });
addEventListener('appinstalled',()=>{ deferred=null; ls.set(HINT_KEY,'installed'); hideHint(); refreshInstall(); });
async function promptInstall(){
  if(!deferred) return;
  const e=deferred; deferred=null; e.prompt();
  try{ const c=await e.userChoice; if(c&&c.outcome==='accepted') ls.set(HINT_KEY,'installed'); }catch(err){}
  hideHint(); refreshInstall();
}
function installHTML(){
  if(standalone()) return `<p class="muted sm">${t('web.installed')}</p>`;
  if(deferred) return `<p class="muted sm">${t('web.installP')}</p><div class="row gap"><button class="btn primary" data-web="install">${t('web.installBtn')}</button></div>`;
  if(isIOS) return `<p class="muted sm">${t('web.installP')} ${t('web.installIOS').replace('{i}',SHARE_ICON)}</p>`;
  return `<p class="muted sm">${t('web.installP')} ${t('web.installOther')}</p>`;
}
function refreshInstall(){ const r=$('#instBody'); if(r) r.innerHTML=installHTML(); }

/* ---------------- first-visit hint (dismissible, max 3 visits, never once dismissed) ---------------- */
let hintEl=null;
function maybeHint(){
  if(hintEl||standalone()||ls.get(HINT_KEY)||visits>3) return;
  if(!isIOS&&!deferred) return;
  if(root.classList.contains('sheet-open')){ setTimeout(maybeHint,4000); return; }
  hintEl=document.createElement('div'); hintEl.className='hint'; hintEl.setAttribute('role','dialog');
  hintEl.innerHTML=hintHTML(); document.body.appendChild(hintEl); root.classList.add('hint-on');
}
function hintHTML(){
  return `<div class="hint-b"><b>${t('web.install')}</b><p>${isIOS?t('web.installIOS').replace('{i}',SHARE_ICON):t('web.installP')}</p></div>
    <div class="hint-a">${!isIOS&&deferred?`<button class="btn primary" data-web="install">${t('web.installBtn')}</button>`:''}<button class="btn ghost" data-web="hintx">${isIOS?t('web.dismiss'):t('web.later')}</button></div>`;
}
function hideHint(){ if(hintEl){ hintEl.remove(); hintEl=null; } root.classList.remove('hint-on'); }
onLang(()=>{ if(hintEl) hintEl.innerHTML=hintHTML(); });

/* ---------------- settings (web) ---------------- */
function renderSettings(){
  const el=$('#v-settings'), d=store.data, lp=LR.lang;
  el.innerHTML=`<header class="vh"><div><h1>${t('s.h')}</h1></div></header>
  <div class="card set">
    <div class="srow"><div><h3>${t('s.lang')}</h3></div><div class="seg">${[['sc','简中'],['tc','繁中'],['en','English']].map(([k,l])=>`<button data-lang="${k}" aria-pressed="${lp===k}">${l}</button>`).join('')}</div></div>
    <div class="srow"><div><h3>${t('web.install')}</h3><div id="instBody">${installHTML()}</div></div></div>
    <div class="srow"><div><h3>${t('web.remind')}</h3><p class="muted sm">${t('web.remindP')}</p></div></div>
  </div>
  <div class="card set">
    <div class="srow"><div><h3>${t('s.data')}</h3><p class="muted sm">${t('s.dataP')}</p></div></div>
    <div class="row gap wrap">
      <button class="btn ghost" data-act="export">${t('s.export')}</button>
      <button class="btn ghost" data-web="import">${t('web.import')}</button>
      ${d.sampleOn?`<button class="btn ghost" data-act="sampleClear">${t('ins.sampleClear')}</button>`:`<button class="btn ghost" data-act="sample">${t('ins.sampleBtn')}</button>`}
      <button class="btn danger" data-act="wipe">${t('s.delete')}</button>
    </div>
    <p class="muted xs set-note">${t('web.compat')}</p>
    <p class="muted xs set-note">${t('web.backup')}</p>
  </div>
  <div class="card set"><h3>${t('s.about')}</h3><p class="muted sm">${t('web.aboutP',{v:LRWeb.version})}</p><p class="sm set-links"><a href="../#download">${t('web.desktop')}</a></p></div>`;
  $$('[data-lang]',el).forEach(b=>b.addEventListener('click',async()=>{ setLang(b.dataset.lang); await store.update(x=>{ x.settings.lang=b.dataset.lang; }); LRMain.render(); }));
}
LRMain.R.settings=renderSettings;

/* ---------------- import ---------------- */
function pickFile(accept){
  return new Promise(res=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept=accept; inp.style.display='none'; document.body.appendChild(inp);
    inp.addEventListener('cancel',()=>{ inp.remove(); res(null); });
    inp.addEventListener('change',()=>{ const f=inp.files&&inp.files[0]; inp.remove(); res(f||null); });
    inp.click();
  });
}
const isDay=k=>/^\d{4}-\d{2}-\d{2}$/.test(k);
function validMatch(m){ return m&&typeof m==='object'&&typeof m.day==='string'&&isDay(m.day)&&['W','L','D'].includes(m.result)&&['val','cs2'].includes(m.game)&&LRStats.validMatch(m)&&(!m.at||typeof m.at==='string'); }
// Merge a desktop or web export into the current data. Same day: the newer check-in wins. Matches: by id.
function mergeInto(d,inc){
  const fresh=!Object.keys(d.checkins).length&&!d.matches.length;
  Object.entries(inc.checkins&&typeof inc.checkins==='object'?inc.checkins:{}).forEach(([k,v])=>{
    if(!isDay(k)||!v||!Array.isArray(v.a)||v.healthLog&&(!window.LRHealth||!LRHealth.valid(v.healthLog))) return;
    const cur=d.checkins[k]; if(!cur||String(v.at||'')>String(cur.at||'')) d.checkins[k]=v;
  });
  const ids=new Set(d.matches.map(m=>m.id));
  (Array.isArray(inc.matches)?inc.matches:[]).forEach(m=>{
    if(!validMatch(m)) return; m=Object.assign({},m);
    if(!m.id) m.id=LR.uid(); if(ids.has(m.id)) return;
    if(!m.at) m.at=new Date(LR.parseKey(m.day).getTime()).toISOString();
    d.matches.push(m); ids.add(m.id);
  });
  Object.entries(inc.goals&&typeof inc.goals==='object'?inc.goals:{}).forEach(([k,g])=>{ if(isDay(k)&&g&&g.kind&&!d.goals[k]) d.goals[k]=g; });
  const L=inc.lineups||{};
  ['fav','learned'].forEach(x=>{ if(Array.isArray(L[x])) L[x].forEach(id=>{ if(typeof id==='string'&&!d.lineups[x].includes(id)) d.lineups[x].push(id); }); });
  if(L.last&&typeof L.last==='object'&&!(d.lineups.last&&d.lineups.last.game)) d.lineups.last=L.last;
  if(inc.sampleOn) d.sampleOn=true;
  if(fresh&&inc.settings&&typeof inc.settings==='object'){ const lang=d.settings.lang; Object.assign(d.settings,inc.settings,{lang}); }
  return d;
}
async function doImport(){
  const f=await pickFile('.json,application/json'); if(!f) return;
  let inc=null;
  try{ inc=JSON.parse(await f.text()); }catch(e){}
  if(!inc||typeof inc!=='object'||Array.isArray(inc)||(!inc.checkins&&!inc.matches)){ toast(t('web.importBad'),3000); return; }
  const c=Object.keys(inc.checkins||{}).filter(isDay).length, m=(Array.isArray(inc.matches)?inc.matches:[]).filter(validMatch).length;
  if(!await LR.confirm(t('web.importQ',{c,m}),t('web.importBtn'))) return;
  const ws=inc.webShots&&typeof inc.webShots==='object'?inc.webShots:{};
  for(const [id,url] of Object.entries(ws)) if(/^[a-z0-9]+$/i.test(id)&&typeof url==='string'&&url.startsWith('data:image/')) await LRWeb.shots.put(id,url);
  await store.update(d=>mergeInto(d,inc));
  toast(t('web.imported')); LRMain.render();
}

/* ---------------- screenshot thumbnails ---------------- */
const thumbCache=new Map();
async function thumbURL(id){ if(!thumbCache.has(id)) thumbCache.set(id,await LRWeb.shots.get(id)||null); return thumbCache.get(id); }
let thumbQ=0;
function fillThumbs(){
  cancelAnimationFrame(thumbQ);
  thumbQ=requestAnimationFrame(()=>{
    $$('.mrow .shot:not([data-th])').forEach(async el=>{
      el.dataset.th='1'; el.setAttribute('role','button'); el.tabIndex=0;
      const id=LRWeb.shotId(el.getAttribute('title')); if(!id) return;
      const u=await thumbURL(id); if(!u) return;
      el.innerHTML=`<img class="sthumb" src="${u}" alt="">`;
    });
  });
}
new MutationObserver(fillThumbs).observe(document.body,{childList:true,subtree:true});
async function viewShot(ref){
  const id=LRWeb.shotId(ref);
  if(!id){ toast(t('web.shotRemote'),2600); return; }
  const u=await thumbURL(id); if(!u){ toast(t('web.shotGone')); return; }
  const w=document.createElement('div'); w.className='modal viewer';
  w.innerHTML=`<img src="${u}" alt=""><button class="btn ghost" data-close>${t('close')}</button>`;
  document.body.appendChild(w); requestAnimationFrame(()=>w.classList.add('on'));
  w.addEventListener('click',()=>w.remove());
}

/* ---------------- full-screen sheets: body class + Android back closes them ---------------- */
const host=$('#v-inline'); let sheetOpen=false, skipPop=false;
new MutationObserver(()=>{
  const open=!!host.firstElementChild;
  if(open&&!sheetOpen){ sheetOpen=true; root.classList.add('sheet-open'); host.scrollTop=0; try{ history.pushState({lrSheet:1},''); }catch(e){} }
  else if(!open&&sheetOpen){ sheetOpen=false; root.classList.remove('sheet-open'); scrollTo(0,0); if(history.state&&history.state.lrSheet){ skipPop=true; history.back(); } }
}).observe(host,{childList:true});
addEventListener('popstate',()=>{
  if(skipPop){ skipPop=false; return; }
  if(sheetOpen) document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
});

/* ---------------- clicks ---------------- */
document.addEventListener('click',e=>{
  const w=e.target.closest('[data-web]');
  if(w){ const a=w.dataset.web;
    if(a==='install') promptInstall();
    else if(a==='hintx'){ ls.set(HINT_KEY,'dismissed'); hideHint(); }
    else if(a==='import') doImport();
    else if(a==='reload') location.reload();
    return; }
  const s=e.target.closest('.mrow .shot'); if(s){ viewShot(s.getAttribute('title')); return; }
  if(e.target.closest('#nav button[data-view]')) scrollTo(0,0);
  // phone lineups: picking a card jumps to its details
  if(e.target.closest('#v-inline [data-sel]')&&innerWidth<768) setTimeout(()=>{ const d=$('#luDetail'); if(d) d.scrollIntoView({block:'start'}); },0);
});

// deleting a game on a touch screen asks first (the desktop app deletes on click)
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-del]'); if(!b) return;
  e.stopPropagation(); e.preventDefault();
  const id=b.dataset.del;
  if(!await LR.confirm(t('web.delQ'),t('del'),true)) return;
  await store.update(s=>{ s.matches=s.matches.filter(m=>m.id!==id); }); LRMain.render();
},true);

/* ---------------- day rollover when the app comes back to the foreground ---------------- */
let lastDay=LR.dayKey();
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&LR.dayKey()!==lastDay){ lastDay=LR.dayKey(); LRMain.render(); } });

/* ---------------- service worker ---------------- */
function showUpdate(){
  if($('.upd')) return;
  const b=document.createElement('div'); b.className='upd';
  b.innerHTML=`<span>${t('web.updated')}</span><button class="btn primary" data-web="reload">${t('web.reload')}</button>`;
  document.body.appendChild(b);
}
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  const hadCtrl=!!navigator.serviceWorker.controller;
  addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      document.addEventListener('visibilitychange',()=>{ if(!document.hidden) reg.update().catch(()=>{}); });
    }).catch(e=>console.warn('sw',e));
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(hadCtrl) showUpdate(); });
}
// ask the browser not to evict our data when space is low (granted automatically for installed apps on most browsers)
if(navigator.storage&&navigator.storage.persist) navigator.storage.persisted().then(p=>{ if(!p&&standalone()) navigator.storage.persist(); }).catch(()=>{});

setTimeout(maybeHint,1500);
window.LRWebUI={mergeInto,renderSettings};
})();
