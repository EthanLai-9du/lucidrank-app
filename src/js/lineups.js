/* LucidRank desktop: lineup (utility) lookup. Example data only; the user picks the map
   (we never read game data, so map auto-detection isn't possible). */
(function(){
'use strict';
const {$,$$,esc,t,raw,applyI18n,onLang,invoke,listen,store,gamePill,gameName}=LR;
const {MAPS,AGENTS,UTIL,ABIL,UTIL_NAME,LINEUPS}=LRLineups;
const tx=o=>o?(o[LR.lang]||o.sc||o.en):'';
let st={game:'val',map:'Ascent',agent:'any',util:'any',side:'any',scn:'any',favOnly:false,sel:null,maps:{}};
let running=null;
const SCN=['exec','post','retake','hold'];

const lu=()=>store.data.lineups;
const isFav=id=>lu().fav.includes(id), isLearned=id=>lu().learned.includes(id);
function filtered(){
  return LINEUPS.filter(x=>x.game===st.game&&x.map===st.map
    &&(st.game!=='val'||st.agent==='any'||x.agent===st.agent)
    &&(st.game!=='cs2'||st.util==='any'||x.util===st.util)
    &&(st.side==='any'||x.side===st.side)&&(st.scn==='any'||x.scn===st.scn)&&(!st.favOnly||isFav(x.id)));
}
const chip=(attr,val,label,on)=>`<button class="chip" data-${attr}="${esc(val)}" aria-pressed="${on}">${label}</button>`;
function title(x){ return `${esc(tx(ABIL[x.ab]))} <span class="arrow">→</span> ${esc(tx(x.to))}`; }

function renderFilters(){
  const el=$('#luFilters'), maps=Object.keys(MAPS[st.game]);
  el.innerHTML=`
    <div class="seg full">${['val','cs2'].map(g=>`<button data-game="${g}" aria-pressed="${st.game===g}">${gameName(g)}</button>`).join('')}</div>
    <div class="fblock"><label class="lbl">${t('lu.map')}</label><div class="chips">${maps.map(m=>chip('map',m,m,st.map===m)).join('')}</div>
      <p class="muted xs">${t('lu.pickMap')}</p></div>
    ${st.game==='val'
      ?`<div class="fblock"><label class="lbl">${t('lu.agent')}</label><div class="chips">${chip('agent','any',t('lu.any'),st.agent==='any')}${AGENTS.map(a=>chip('agent',a,a,st.agent===a)).join('')}</div></div>`
      :`<div class="fblock"><label class="lbl">${t('lu.util')}</label><div class="chips">${chip('util','any',t('lu.any'),st.util==='any')}${UTIL.map(u=>chip('util',u,esc(tx(UTIL_NAME[u])),st.util===u)).join('')}</div></div>`}
    <div class="fblock"><label class="lbl">${t('lu.side')}</label><div class="seg full">${[['any',t('lu.any')],['atk',t('lu.atk')],['def',t('lu.def')]].map(([k,l])=>`<button data-side="${k}" aria-pressed="${st.side===k}">${l}</button>`).join('')}</div></div>
    <div class="fblock"><label class="lbl">${t('lu.scn')}</label><div class="chips">${chip('scn','any',t('lu.any'),st.scn==='any')}${SCN.map(s=>chip('scn',s,t('lu.s.'+s),st.scn===s)).join('')}</div></div>
    <label class="chk"><input type="checkbox" id="favOnly"${st.favOnly?' checked':''}><i></i>${t('lu.favOnly')}</label>`;
}
function renderList(){
  const el=$('#luList'), list=filtered();
  if(!list.find(x=>x.id===st.sel)) st.sel=list[0]?list[0].id:null;
  el.innerHTML=`<div class="lu-count muted xs">${st.map} · ${t('lu.count',{n:list.length})}</div>`+(list.length?list.map(x=>`
    <button class="lcard${x.id===st.sel?' on':''}" data-sel="${x.id}">
      <span class="lt">${title(x)}</span>
      <span class="lm">${esc(x.agent||tx(UTIL_NAME[x.util]))} · ${t('lu.'+x.side)} · ${t('lu.s.'+x.scn)}</span>
      <span class="lflags">${isFav(x.id)?'<b class="fav">★</b>':''}${isLearned(x.id)?'<b class="lrn">✓</b>':''}</span>
    </button>`).join(''):`<p class="muted sm pad">${t('lu.none')}</p>`);
  const all=LINEUPS.filter(x=>x.game===st.game);
  $('#luProg').textContent=t('lu.progress',{x:all.filter(x=>isLearned(x.id)).length,n:all.length});
}
function minimap(x){
  const M=MAPS[x.game][x.map];
  const ctl=[2*x.m[0]-(x.s[0]+x.l[0])/2, 2*x.m[1]-(x.s[1]+x.l[1])/2];
  let g=`<defs><linearGradient id="pathG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#45e6c4"/><stop offset="1" stop-color="#ff6a3d"/></linearGradient>
    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="rgba(255,255,255,.035)" stroke-width=".3"/></pattern></defs>
    <rect x="0" y="0" width="100" height="100" rx="3" fill="#0e0e12"/><rect x="0" y="0" width="100" height="100" fill="url(#grid)"/>`;
  g+=M.areas.map(a=>`<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx="1.6" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.13)" stroke-width=".35"/>`).join('');
  g+=Object.entries(M.sites).map(([k,p])=>`<text x="${p[0]}" y="${p[1]+3}" class="site${x.site===k?' on':''}" text-anchor="middle">${k}</text>`).join('');
  if(M.tp) g+=M.tp.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="none" stroke="rgba(255,255,255,.3)" stroke-width=".4" stroke-dasharray="1 .8"/>`).join('');
  g+=`<text x="${M.atk[0]}" y="${M.atk[1]+5}" class="spawn" text-anchor="middle">${t('lu.atk')}</text><text x="${M.def[0]}" y="${M.def[1]-2.5}" class="spawn" text-anchor="middle">${t('lu.def')}</text>`;
  g+=`<path d="M${x.s[0]} ${x.s[1]} Q${ctl[0]} ${ctl[1]} ${x.l[0]} ${x.l[1]}" fill="none" stroke="url(#pathG)" stroke-width=".9" stroke-dasharray="2 1.4" stroke-linecap="round" class="throw"/>`;
  g+=`<circle cx="${x.l[0]}" cy="${x.l[1]}" r="5" fill="rgba(255,106,61,.16)" stroke="rgba(255,106,61,.6)" stroke-width=".4"/><circle cx="${x.l[0]}" cy="${x.l[1]}" r="1.2" fill="#ff6a3d"/>`;
  g+=`<g transform="translate(${x.m[0]} ${x.m[1]})" stroke="#ffc46b" stroke-width=".55" stroke-linecap="round"><circle r="2.4" fill="rgba(10,10,12,.7)"/><path d="M0 -3.8V-1.4M0 1.4V3.8M-3.8 0H-1.4M1.4 0H3.8"/></g>`;
  g+=`<circle cx="${x.s[0]}" cy="${x.s[1]}" r="2.6" fill="rgba(69,230,196,.18)" stroke="#45e6c4" stroke-width=".5"/><circle cx="${x.s[0]}" cy="${x.s[1]}" r="1" fill="#45e6c4"/>`;
  return `<svg class="mm" viewBox="-2 -2 104 104" role="img" aria-label="${esc(x.map)}">${g}</svg>`;
}
function renderDetail(){
  const el=$('#luDetail'), x=LINEUPS.find(y=>y.id===st.sel);
  if(!x){ el.innerHTML=`<div class="lu-empty muted">${t('lu.none')}</div>`; return; }
  el.innerHTML=`
    <div class="ld-head"><div><h2>${title(x)}</h2><p class="muted sm">${esc(x.map)} · ${esc(x.agent||tx(UTIL_NAME[x.util]))} · ${t('lu.'+x.side)} · ${t('lu.s.'+x.scn)}</p></div>
      <div class="row gap"><button class="tbtn${isFav(x.id)?' on':''}" data-tog="fav" aria-pressed="${isFav(x.id)}">★ ${t('lu.fav')}</button><button class="tbtn lrn${isLearned(x.id)?' on':''}" data-tog="learned" aria-pressed="${isLearned(x.id)}">✓ ${t('lu.learned')}</button></div></div>
    <div class="ld-body">
      <div class="mm-wrap">${minimap(x)}<div class="legend"><span><i class="lg s"></i>${t('lu.stand')}</span><span><i class="lg m"></i>${t('lu.aim')}</span><span><i class="lg l"></i>${t('lu.land')}</span><span class="tag-demo">${t('sample')}</span></div></div>
      <div class="steps"><p class="lbl">${t('lu.steps')}</p>
        <ol><li><b>${t('lu.stand')}</b>${esc(tx(x.stand))}</li><li><b>${t('lu.aim')}</b>${esc(tx(x.aim))}</li><li><b>${esc(tx(ABIL[x.ab]))}</b>${t('lu.t.'+x.throw)}</li></ol></div>
    </div>`;
}
function render(){ renderFilters(); renderList(); renderDetail(); }
let saveT=0;
function remember(){ clearTimeout(saveT); saveT=setTimeout(()=>store.update(d=>{ d.lineups.last=Object.assign({},st); }),400); }

document.addEventListener('click',async e=>{
  const b=e.target.closest('button'); if(!b) return;
  const d=b.dataset;
  if(d.game){ st.game=d.game; st.map=st.maps[st.game]||Object.keys(MAPS[st.game])[0]; st.sel=null; }
  else if(d.map){ st.map=d.map; st.maps[st.game]=d.map; st.sel=null; }
  else if(d.agent) st.agent=d.agent;
  else if(d.util) st.util=d.util;
  else if(d.side) st.side=d.side;
  else if(d.scn) st.scn=d.scn;
  else if(d.sel) st.sel=d.sel;
  else if(d.tog){ const k=d.tog, id=st.sel; await store.update(s=>{ const a=s.lineups[k]; const i=a.indexOf(id); i>=0?a.splice(i,1):a.push(id); }); }
  else return;
  render(); remember();
});
document.addEventListener('change',e=>{ if(e.target.id==='favOnly'){ st.favOnly=e.target.checked; render(); remember(); } });
addEventListener('keydown',e=>{
  if(e.key==='Escape') invoke('close_self');
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ const l=filtered(), i=l.findIndex(x=>x.id===st.sel); const n=l[Math.max(0,Math.min(l.length-1,i+(e.key==='ArrowDown'?1:-1)))]; if(n){ st.sel=n.id; renderList(); renderDetail(); e.preventDefault(); } }
});
onLang(render);

(async()=>{
  applyI18n();
  await store.load();
  const last=lu().last||{}; if(last.game&&MAPS[last.game]&&MAPS[last.game][last.map]) st=Object.assign(st,last,{maps:Object.assign({},last.maps||{})});
  running=await invoke('game_status').catch(()=>null);
  if(running&&running!==st.game&&MAPS[running]){ st.game=running; st.map=st.maps[running]||Object.keys(MAPS[running])[0]; st.sel=null; }
  gamePill($('#gamePill'),running);
  listen('game-status',p=>{ running=p&&p.game; gamePill($('#gamePill'),running); });
  listen('data-changed',async p=>{ if(p&&p.from==='lineups') return; await store.load(); renderList(); renderDetail(); });
  render();
})();
})();
