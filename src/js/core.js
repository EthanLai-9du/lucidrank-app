/* LucidRank desktop: shared core (i18n, Tauri bridge with a browser mock, store, dates).
   Loaded synchronously in <head> after i18n.js so the language is set before first paint. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- i18n (same approach as the concept site) ---------------- */
const LANGS={sc:'zh-Hans',tc:'zh-Hant',en:'en'};
function sysLang(){ const n=(navigator.language||'').toLowerCase(); return /^zh-(tw|hk|mo|hant)/.test(n)?'tc':/^zh/.test(n)?'sc':'en'; }
let pref=null; try{ pref=localStorage.getItem('lr-lang'); }catch(e){}
if(!LANGS[pref]) pref=null;
let LANG=pref||sysLang();
const root=document.documentElement; root.lang=LANGS[LANG]; root.dataset.lang=LANG;
function raw(key){
  const [k,idx]=key.split('#'), e=I18N[k];
  if(!e){ console.warn('i18n: missing',key); return key; }
  const v=(LANG in e)?e[LANG]:e.sc;
  return idx===undefined?v:v[+idx];
}
// t('key',{n:3}): args are HTML-escaped; '@key' args are translated
function t(key,args){
  if(args&&args.n==1){ const one=I18N[key+'.one']; if(one&&LANG in one) key+='.one'; }
  let v=raw(key); if(typeof v!=='string'||!args) return v;
  return v.replace(/\{(\w+)\}/g,(m,n)=>!(n in args)?m:(typeof args[n]==='string'&&args[n][0]==='@')?raw(args[n].slice(1)):esc(args[n]));
}
function applyI18n(scope=document){
  $$('[data-i18n]',scope).forEach(el=>{ const a=el.dataset.i18nArgs; el.innerHTML=t(el.dataset.i18n,a?JSON.parse(a):null); });
  $$('[data-i18n-attr]',scope).forEach(el=>el.dataset.i18nAttr.split(';').forEach(p=>{ const [attr,key]=p.split(':'); el.setAttribute(attr,t(key)); }));
}
const langHooks=[];
function setLang(choice){ // choice: 'auto' | sc | tc | en
  pref=LANGS[choice]?choice:null;
  try{ pref?localStorage.setItem('lr-lang',pref):localStorage.removeItem('lr-lang'); }catch(e){}
  LANG=pref||sysLang(); root.lang=LANGS[LANG]; root.dataset.lang=LANG;
  applyI18n(); langHooks.forEach(f=>f()); pushLabels();
}
function onLang(f){ langHooks.push(f); }

/* ---------------- Tauri bridge (falls back to a localStorage mock in a plain browser) ---------------- */
const T=window.__TAURI__;
const isTauri=!!(T&&T.core);
const mockListeners={};
const MOCK_KEY='lr-mock-data';
const mock={
  load_data:()=>{ try{ return JSON.parse(localStorage.getItem(MOCK_KEY)||'{}'); }catch(e){ return {}; } },
  save_data:({data})=>{ localStorage.setItem(MOCK_KEY,JSON.stringify(data)); return null; },
  data_location:()=>'%APPDATA%\\hk.lucidrank.desktop\\lucidrank-data.json',
  delete_all_data:()=>{ localStorage.removeItem(MOCK_KEY); return null; },
  export_data:()=>{ const b=new Blob([localStorage.getItem(MOCK_KEY)||'{}'],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='lucidrank-export.json'; a.click(); return 'lucidrank-export.json'; },
  pick_screenshot:()=>'C:\\Users\\you\\Pictures\\VALORANT\\match_result.png',
  game_status:()=>new URLSearchParams(location.search).get('game')||null,
  skip_today:()=>null,
  open_window:({kind})=>{ if(kind==='checkin') window.open('checkin.html'+location.search,'checkin','width=440,height=680'); else if(kind==='lineups') window.open('lineups.html'+location.search,'lineups','width=1120,height=760'); return null; },
  close_self:()=>{ window.close(); return null; },
  set_labels:()=>null,
  autostart_get:()=>localStorage.getItem('lr-mock-autostart')==='1',
  autostart_set:({on})=>{ localStorage.setItem('lr-mock-autostart',on?'1':'0'); return on; },
  app_info:()=>({version:'0.1.0',today:dayKey(),os:'browser'}),
};
async function invoke(cmd,args={}){
  if(isTauri) return T.core.invoke(cmd,args);
  return mock[cmd](args);
}
async function listen(ev,fn){
  if(isTauri) return T.event.listen(ev,e=>fn(e.payload));
  (mockListeners[ev]=mockListeners[ev]||[]).push(fn);
  if(ev==='data-changed') addEventListener('storage',e=>{ if(e.key===MOCK_KEY) fn({from:'other'}); });
}
function pushLabels(){
  invoke('set_labels',{labels:{open:t('tray.open'),checkin:t('tray.checkin'),lineups:t('tray.lineups'),quit:t('tray.quit'),tooltip:'LucidRank',
    notif_title:t('notif.t'),notif_body:t('notif.b'),tray_hint_title:t('notif.hintT'),tray_hint_body:t('notif.hintB')}}).catch(()=>{});
}

/* ---------------- dates: a "day" rolls over at 05:00 (matches the Rust side) ---------------- */
const ROLL_H=5;
const pad=n=>String(n).padStart(2,'0');
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function dayKey(ts=Date.now()){ return keyOf(new Date(ts-ROLL_H*3600e3)); }
function parseKey(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d,12); }
function addDays(k,n){ const d=parseKey(k); d.setDate(d.getDate()+n); return keyOf(d); }
function weekStart(k){ const d=parseKey(k); const wd=(d.getDay()+6)%7; d.setDate(d.getDate()-wd); return keyOf(d); }
function weekDays(ws){ return [...Array(7)].map((_,i)=>addDays(ws,i)); }
function weekdayIdx(k){ return (parseKey(k).getDay()+6)%7; }
function fmtDate(k){ const d=parseKey(k); return t('date.md',{m:d.getMonth()+1,d:d.getDate(),mon:raw('mon')[d.getMonth()]||''})+' '+raw('wk')[weekdayIdx(k)]; }

/* ---------------- store ---------------- */
const DEFAULT=()=>({version:1,settings:{lang:'auto',watch:{val:true,cs2:true}},checkins:{},matches:[],goals:{},lineups:{fav:[],learned:[],last:{}}});
function normalize(d){
  const b=DEFAULT(); d=d&&typeof d==='object'?d:{};
  d.version=1; d.settings=Object.assign(b.settings,d.settings||{}); d.settings.watch=Object.assign({val:true,cs2:true},d.settings.watch||{});
  d.checkins=d.checkins||{}; d.matches=Array.isArray(d.matches)?d.matches:[]; d.goals=d.goals||{};
  d.lineups=Object.assign(b.lineups,d.lineups||{});
  return d;
}
const store={
  data:DEFAULT(),
  async load(){ this.data=normalize(await invoke('load_data')); return this.data; },
  // Always re-read before writing so several windows don't overwrite each other.
  async update(fn){ await this.load(); fn(this.data); await invoke('save_data',{data:this.data}); return this.data; },
};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* ---------------- small UI helpers ---------------- */
function toast(msg,ms=2200){
  let el=$('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.innerHTML=msg; el.classList.add('on'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('on'),ms);
}
function gameName(g){ return g==='cs2'?'CS2':'VALORANT'; }
function gamePill(el,g){
  el.classList.toggle('on',!!g);
  el.innerHTML=`<i></i><span>${g?t('game.on',{g:gameName(g)}):t('game.none')}</span>`;
}
// In a plain browser keep links between pages working
function preventDragNav(){ addEventListener('dragover',e=>e.preventDefault()); addEventListener('drop',e=>e.preventDefault()); }

window.LR={$,$$,esc,t,raw,applyI18n,setLang,onLang,get lang(){return LANG;},get langPref(){return pref||'auto';},
  isTauri,invoke,listen,pushLabels,dayKey,parseKey,addDays,weekStart,weekDays,weekdayIdx,fmtDate,store,uid,toast,gameName,gamePill,preventDragNav};
})();
