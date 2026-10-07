/* LucidRank desktop: in-app updates (UI side). Desktop only: index.html loads this file, the web build
   (lucidrank-pwa) doesn't, so there window.LRUpdater is undefined and Settings has no update card.
   - checks quietly at launch and then at most every 6 hours (Settings → "Check for updates automatically")
   - a newer version shows a small card in the corner; nothing installs until "Update now"
   - download progress → install → relaunch (Rust: src-tauri/src/updater.rs, signed + verified)
   - errors stay quiet: console only, plus a short line in Settings when you checked by hand */
(function(){
'use strict';
const {$,esc,t,invoke,listen,store,toast,onLang}=LR;
if(!LR.isTauri) return;
const KEY='lr-update', SIX_H=6*3600e3;
const mem=()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } };
const remember=o=>{ try{ localStorage.setItem(KEY,JSON.stringify(Object.assign(mem(),o))); }catch(e){} };
const autoOn=()=>store.data.settings.autoUpdate!==false;
const st={info:null,checking:false,manual:'',phase:'idle',got:0,total:0,src:0,current:''};

/* notes: either plain text, or one line per language ("sc: …", "tc: …", "en: …") */
function notes(n){
  if(!n) return '';
  const lines=String(n).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const mine=lines.find(l=>l.toLowerCase().startsWith(LR.lang+':'));
  if(mine) return mine.slice(3).trim();
  return lines.filter(l=>!/^(sc|tc|en):/i.test(l)).join(' ');
}
const mb=b=>(b/1048576).toFixed(1);
function pctText(){
  if(!st.total) return st.got?`${mb(st.got)} MB`:'';
  return `${Math.min(100,Math.floor(st.got/st.total*100))}% · ${mb(st.got)} / ${mb(st.total)} MB`;
}

/* ---------------- corner card ---------------- */
let card=null;
function hideCard(){ if(card){ card.remove(); card=null; } }
function renderCard(){
  if(!st.info||st.phase==='hidden'){ hideCard(); return; }
  if(!card){ card=document.createElement('div'); card.className='upd'; card.setAttribute('role','status'); document.body.appendChild(card); }
  const busy=st.phase==='download'||st.phase==='install';
  const n=notes(st.info.notes);
  let body='';
  if(st.phase==='download') body=`<div class="upd-p"><div class="upd-bar"><i style="width:${st.total?Math.min(100,st.got/st.total*100):4}%"></i></div><span class="num">${st.src>0&&!st.got?t('up.alt'):t('up.dl',{p:pctText()})}</span></div>`;
  else if(st.phase==='install') body=`<div class="upd-p"><div class="upd-bar"><i style="width:100%"></i></div><span>${t('up.installing')}</span></div>`;
  else if(st.phase==='error') body=`<p class="upd-msg">${t('up.dlFail')}</p>`;
  else if(st.phase==='dry') body=`<p class="upd-msg ok">${t('up.dry')}</p>`;
  const btns=busy?'':(st.phase==='error'||st.phase==='dry')
    ?`<button class="btn ghost sm" data-upd="later">${t('tb.close')}</button>`
    :`<button class="btn ghost sm" data-upd="later">${t('up.later')}</button><button class="btn primary sm" data-upd="now">${t('up.now')}</button>`;
  card.innerHTML=`<div class="upd-h"><b>${t('up.found',{v:st.info.version})}</b></div>${n?`<p class="upd-n">${esc(n)}</p>`:''}${body}${btns?`<div class="row gap end">${btns}</div>`:''}`;
}

/* ---------------- Settings card (main.js calls LRUpdater.card()) ---------------- */
function statusLine(){
  if(st.checking) return `<p class="muted sm">${t('up.checking')}</p>`;
  if(st.info) return `<p class="sm upd-avail">${t('up.found',{v:st.info.version})}${st.phase==='idle'||st.phase==='hidden'?` <button class="link-btn" data-upd="now">${t('up.now')}</button>`:''}</p>`;
  if(st.manual==='latest') return `<p class="muted sm">${t('up.latest')}</p>`;
  if(st.manual==='failed') return `<p class="sm upd-err">${t('up.failed')}</p>`;
  return '';
}
function inner(){
  return `<div class="srow"><div><h3>${t('up.h')}</h3><p class="muted sm">${t('up.cur',{v:st.current||'—'})}</p><div class="upd-status">${statusLine()}</div></div>
    <button class="btn ghost sm" data-upd="check"${st.checking||st.phase==='download'||st.phase==='install'?' disabled':''}>${t('up.check')}</button></div>
  <div class="srow"><div><h3>${t('up.auto')}</h3><p class="muted sm">${t('up.autoP')}</p></div><label class="sw"><input type="checkbox" id="swUpd"${autoOn()?' checked':''}><i></i></label></div>`;
}
function card_(){ return `<div class="card set" id="updCard">${inner()}</div>`; }
function refreshSettings(){ const c=document.getElementById('updCard'); if(c) c.innerHTML=inner(); }
function refresh(){ renderCard(); refreshSettings(); }

/* ---------------- actions ---------------- */
async function check(manual){
  if(st.checking||st.phase==='download'||st.phase==='install') return;
  st.checking=true; st.manual=''; refreshSettings();
  try{
    const r=await invoke('update_check');
    remember({last:Date.now()});
    if(r&&r.current) st.current=r.current;
    if(r&&r.available){
      const sn=mem().snooze, snoozed=!manual&&sn&&sn.v===r.version&&sn.until>Date.now();
      const same=st.info&&st.info.version===r.version;
      st.info=r;
      if(!same||manual) st.phase=snoozed?'hidden':'idle';
    }else{ st.info=null; st.phase='idle'; if(manual) st.manual='latest'; }
  }catch(e){
    console.warn('update check failed:',e);
    if(manual) st.manual='failed';
  }
  st.checking=false; refresh();
}
async function install(){
  if(!st.info||st.phase==='download'||st.phase==='install') return;
  st.phase='download'; st.got=0; st.total=0; st.src=0; refresh();
  try{
    const r=await invoke('update_install');
    // Windows: the installer takes over and the app exits; elsewhere it restarts. Only the debug dry run gets here.
    if(String(r).startsWith('dry-run')){ st.phase='dry'; refresh(); }
  }catch(e){
    console.warn('update failed:',e);
    st.phase='error'; refresh();
  }
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-upd]'); if(!b) return;
  e.preventDefault();
  const a=b.dataset.upd;
  if(a==='check') check(true);
  else if(a==='now'){ st.phase='idle'; install(); }
  else if(a==='later'){
    if(st.info&&st.phase!=='error'&&st.phase!=='dry') remember({snooze:{v:st.info.version,until:Date.now()+SIX_H}});
    st.phase='hidden'; refresh();
  }
});
document.addEventListener('change',async e=>{
  if(e.target.id!=='swUpd') return;
  const on=e.target.checked;
  await store.update(d=>{ d.settings.autoUpdate=on; });
  if(on&&Date.now()-(mem().last||0)>=SIX_H) check(false);
});
listen('update-progress',p=>{
  if(!p) return;
  if(p.phase==='download'){ if(st.phase!=='download') return; st.got=p.got||0; st.total=p.total||0; st.src=p.src||0; renderCard(); }
  else if(p.phase==='install'){ st.phase='install'; refresh(); }
});
onLang(renderCard);

window.LRUpdater={card:card_,check};

/* ---------------- boot ---------------- */
(async()=>{
  try{ const i=await invoke('app_info'); st.current=i.version; refreshSettings(); }catch(e){}
  invoke('update_notice').then(v=>{ if(v) toast(t('up.done',{v})); }).catch(()=>{});
  await new Promise(r=>setTimeout(r,4000));
  try{ await store.load(); }catch(e){}
  if(autoOn()) check(false);
  setInterval(()=>{ if(autoOn()&&Date.now()-(mem().last||0)>=SIX_H) check(false); },10*60e3);
})();
})();
