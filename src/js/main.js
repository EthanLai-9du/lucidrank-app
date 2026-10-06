/* LucidRank desktop: main window (Today · Matches · Insights · This week · Settings). */
(function(){
'use strict';
const {$,$$,esc,t,raw,applyI18n,setLang,onLang,invoke,listen,store,dayKey,addDays,weekStart,weekDays,weekdayIdx,fmtDate,uid,toast,gameName,gamePill}=LR;
const S=LRStats;
const MAPS={val:['Abyss','Ascent','Bind','Breeze','Corrode','Fracture','Haven','Icebox','Lotus','Pearl','Split','Sunset'],cs2:['Ancient','Anubis','Dust2','Inferno','Mirage','Nuke','Overpass','Train','Vertigo']};
const Q=[['bed',0],['dur',1],['phone',2],['move',3],['gap',4],['meal',5],['pre',6],['caf',7],['mood',8]];
const FLAG={bed:v=>v>=3,dur:v=>v<=1,phone:v=>v>=3,caf:v=>v>=2,mood:v=>v===0,meal:v=>v>=2,pre:v=>v.includes(2)||v.includes(3)};
let view='today', game=null, insGame=null, form={game:'val',result:null,shot:null}, matchFilter='all', proposalIdx=0;
const D=()=>store.data;
const r0=v=>v==null?'—':Math.round(v);
const pct=v=>Math.round(v*100)+'%';

/* ---------------- shared bits ---------------- */
function ansText(k,v){
  if(v==null) return '—';
  if(Array.isArray(v)) return v.map(j=>raw('q.'+k+'.o#'+j)).join(raw('ci.sep'));
  return raw('q.'+k+'.o#'+v);
}
function ciChips(a,compact){
  return `<div class="chips-sum${compact?' compact':''}">${Q.filter(([k,i])=>a[i]!=null&&(!compact||['bed','dur','phone','move','caf','mood'].includes(k))).map(([k,i])=>`<div class="${FLAG[k]&&FLAG[k](a[i])?'flag':''}"><span class="sk">${raw('q.'+k+'.s')}</span>${esc(ansText(k,a[i]))}</div>`).join('')}</div>`;
}
function weekDots(ev){
  const wk=raw('wk.s'), today=dayKey();
  return `<div class="wdots">${ev.days.map((d,i)=>`<div class="wd${d.hit?' hit':''}${d.day===today?' today':''}${d.future?' future':''}"><i></i><span>${wk[i]}</span></div>`).join('')}</div>`;
}
function ring(x,n,size=96){
  const C=2*Math.PI*42, p=Math.min(1,x/n);
  return `<svg class="ring" viewBox="0 0 100 100" width="${size}" height="${size}"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-p)}"/><text x="50" y="50" class="num">${x}<tspan dx="2" class="of">/${n}</tspan></text></svg>`;
}
const sampleTag=()=>D().sampleOn?`<span class="tag-demo">${t('sample')}</span>`:'';

/* ---------------- TODAY ---------------- */
function renderToday(){
  const el=$('#v-today'), today=dayKey(), rec=D().checkins[today];
  const todays=D().matches.filter(m=>m.day===today).sort((a,b)=>b.at.localeCompare(a.at));
  const w=S.weekly(D()), g=w.cur||w.proposals[0], ev=S.evalWeek(g,w.ws,D());
  el.innerHTML=`
  <header class="vh"><div><p class="eyebrow">${esc(fmtDate(today))}</p><h1>${t('today.h')}</h1></div>${sampleTag()}</header>
  <div class="grid2">
    <div class="col">
      <div class="card ci-card${rec?' done':''}">
        ${rec?`<div class="row between"><h2>${t('today.ciDone')} <span class="ok-dot">✓</span></h2><button class="btn ghost sm" data-act="checkin">${t('today.ciRedo')}</button></div>${ciChips(rec.a)}`
             :`<h2>${t('today.ciTodo')}</h2><p class="muted">${t('today.ciTodoP')}</p><div class="ci-cta"><button class="btn primary" data-act="checkin">${t('today.ciGo')}</button><span class="keys"><kbd>1</kbd>–<kbd>5</kbd> · ≈10 s</span></div>`}
      </div>
      <div class="card">
        <h2>${t('today.matches')}</h2>
        ${todays.length?`<div class="mlist">${todays.map(matchRow).join('')}</div>`:`<p class="muted">${t('today.noMatches')}</p>`}
      </div>
    </div>
    <div class="col">
      ${logForm()}
      <div class="card goal-mini" data-go="week">
        <div class="row between"><h2>${t('today.goal')}</h2><span class="link">${t('today.goalMore')}</span></div>
        <div class="row gap">${ring(ev.x,g.n,64)}<div><p class="goal-t">${S.goalText(g)}</p>${w.cur?'':`<p class="muted sm">${t('w.propose')}</p>`}</div></div>
      </div>
    </div>
  </div>`;
  bindForm(el);
}
function matchRow(m){
  const res={W:'win',L:'loss',D:'draw'}[m.result]||'';
  const file=m.shot?m.shot.split(/[\\/]/).pop():'';
  return `<div class="mrow" data-id="${m.id}"><span class="res ${res}">${t('m.'+m.result)}</span><span class="g">${gameName(m.game)}${m.map?` · ${esc(m.map)}`:''}</span>
    <span class="num kda">${[m.k,m.d,m.a].map(v=>v??'–').join(' / ')}</span><span class="num sc">${m.score!=null?`${m.score} <small>${S.metric(m.game)}</small>`:''}</span>
    <span class="rk">${esc(m.rank||'')}</span>${file?`<span class="shot" title="${esc(m.shot)}">🖼 ${esc(file)}</span>`:'<span></span>'}
    <button class="icon-btn" data-del="${m.id}" title="${t('del')}">×</button></div>`;
}
function logForm(){
  const g=form.game;
  return `<form class="card logf" id="logForm" autocomplete="off">
    <div class="row between"><h2>${t('m.h')}</h2><div class="seg" role="group">${['val','cs2'].map(x=>`<button type="button" data-fgame="${x}" aria-pressed="${g===x}">${gameName(x)}</button>`).join('')}</div></div>
    <label class="lbl">${t('m.res')}</label>
    <div class="resbtns">${['W','L','D'].map(r=>`<button type="button" data-res="${r}" class="rb ${r}" aria-pressed="${form.result===r}">${t('m.'+r)}</button>`).join('')}</div>
    <div class="fgrid">
      <div><label class="lbl">K / D / A</label><div class="kda-in"><input name="k" type="number" min="0" max="99" placeholder="K"><input name="d" type="number" min="0" max="99" placeholder="D"><input name="a" type="number" min="0" max="99" placeholder="A"></div></div>
      <div><label class="lbl">${g==='cs2'?t('m.adr'):t('m.acs')}</label><input name="score" type="number" min="0" max="999" placeholder="${g==='cs2'?'85':'240'}"></div>
      <div><label class="lbl">${t('m.map')} <small>${t('optional')}</small></label><select name="map"><option value="">—</option>${MAPS[g].map(m=>`<option>${m}</option>`).join('')}</select></div>
      <div><label class="lbl">${t('m.rank')} <small>${t('optional')}</small></label><input name="rank" maxlength="24" placeholder="${esc(t('m.rankPh'))}"></div>
    </div>
    <div class="shotrow"><button type="button" class="btn ghost sm" id="shotBtn">${form.shot?esc(t('m.shotOn',{f:form.shot.split(/[\\/]/).pop()})):t('m.shot')}</button><span class="soon" title="${esc(t('m.ocrP'))}">${t('m.ocr')}</span></div>
    <p class="muted xs">${t('m.ocrP')}</p>
    <div class="row between"><span class="formmsg" id="formMsg"></span><button class="btn primary" type="submit">${t('m.save')}</button></div>
  </form>`;
}
function bindForm(el){
  const f=$('#logForm',el); if(!f) return;
  $$('[data-fgame]',f).forEach(b=>b.addEventListener('click',()=>{ form.game=b.dataset.fgame; render(); }));
  $$('[data-res]',f).forEach(b=>b.addEventListener('click',()=>{ form.result=b.dataset.res; $$('[data-res]',f).forEach(x=>x.setAttribute('aria-pressed',x===b)); }));
  $('#shotBtn',f).addEventListener('click',async()=>{ const p=await invoke('pick_screenshot'); if(p){ form.shot=p; $('#shotBtn',f).textContent=t('m.shotOn',{f:p.split(/[\\/]/).pop()}).replace(/&amp;/g,'&'); } });
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!form.result){ $('#formMsg',f).textContent=t('m.need'); return; }
    const fd=new FormData(f), n=k=>{ const v=fd.get(k); return v===''||v==null?null:Math.max(0,Math.round(+v)); };
    const m={id:uid(),day:dayKey(),at:new Date().toISOString(),game:form.game,result:form.result,k:n('k'),d:n('d'),a:n('a'),score:n('score'),map:fd.get('map')||'',rank:(fd.get('rank')||'').trim(),shot:form.shot||null};
    await store.update(s=>{ s.matches.push(m); s.settings.lastGame=form.game; });
    form.result=null; form.shot=null; toast(t('m.saved')); render();
  });
}

/* ---------------- MATCHES ---------------- */
function renderMatches(){
  const el=$('#v-matches');
  const ms=D().matches.filter(m=>matchFilter==='all'||m.game===matchFilter).sort((a,b)=>b.at.localeCompare(a.at));
  const by={}; ms.forEach(m=>(by[m.day]=by[m.day]||[]).push(m));
  el.innerHTML=`<header class="vh"><div><h1>${t('m.listH')}</h1></div><div class="row gap">${sampleTag()}<div class="seg">${['all','val','cs2'].map(x=>`<button data-mf="${x}" aria-pressed="${matchFilter===x}">${x==='all'?t('m.all'):gameName(x)}</button>`).join('')}</div></div></header>
  ${ms.length?Object.keys(by).sort().reverse().map(day=>{
    const list=by[day], w=list.filter(m=>m.result==='W').length, l=list.filter(m=>m.result==='L').length, rec=D().checkins[day];
    return `<div class="card dayc"><div class="row between dayh"><b>${esc(fmtDate(day))}</b><span class="muted sm">${t('m.dayStat',{w,l})}</span></div>
      ${rec&&rec.a?ciChips(rec.a,true):`<p class="muted xs">${t('m.noCi')}</p>`}
      <div class="mlist">${list.map(matchRow).join('')}</div></div>`;
  }).join(''):`<div class="card empty"><p class="muted">${t('m.empty')}</p></div>`}`;
  $$('[data-mf]',el).forEach(b=>b.addEventListener('click',()=>{ matchFilter=b.dataset.mf; render(); }));
}

/* ---------------- INSIGHTS ---------------- */
function renderInsights(){
  const el=$('#v-insights');
  const g=insGame||S.mainGame(D()), ins=S.insights(D(),g), m=ins.metric;
  const head=`<header class="vh"><div><h1>${t('ins.h')}</h1><p class="lead">${t('ins.lead')}</p></div>
    <div class="row gap"><div class="seg">${['val','cs2'].map(x=>`<button data-ig="${x}" aria-pressed="${g===x}">${gameName(x)}</button>`).join('')}</div>
    ${D().sampleOn?`<button class="btn ghost sm" data-act="sampleClear">${t('ins.sampleClear')}</button>`:`<button class="btn ghost sm" data-act="sample">${t('ins.sampleBtn')}</button>`}</div></header>
    ${D().sampleOn?`<p class="banner">${t('ins.sampleOn',{n:Object.values(D().checkins).filter(c=>c.sample).length})}</p>`:''}`;
  let body;
  if(ins.need>0){
    body=`<div class="card empty-ins"><div class="need">${t('ins.need',{n:ins.need})}</div>
      <div class="pbar"><i style="width:${ins.have/ins.min*100}%"></i></div>
      <p class="muted">${t('ins.needP',{min:ins.min,have:ins.have})}</p>
      ${D().sampleOn?'':`<button class="btn primary" data-act="sample">${t('ins.sampleBtn')}</button>`}</div>`;
  }else{
    const o=ins.overall;
    body=`<div class="stats4">
      <div class="stat"><b class="num">${ins.have}</b><span>${t('ins.days',{n:ins.have}).replace(/^\d+\s*/,'')}</span></div>
      <div class="stat"><b class="num">${o.games}</b><span>${t('nav.matches')}</span></div>
      <div class="stat"><b class="num">${pct(o.wr)}</b><span>${t('ins.wr')}</span></div>
      <div class="stat"><b class="num">${r0(o.avg)}</b><span>${m}</span></div></div>
    <div class="fgrid2">${ins.factors.map(f=>factorCard(f,m)).join('')}</div>`;
  }
  el.innerHTML=head+body+`<p class="note">${t('ins.note')}</p>`;
  $$('[data-ig]',el).forEach(b=>b.addEventListener('click',()=>{ insGame=b.dataset.ig; render(); }));
}
function factorCard(f,m){
  const w=raw('F.'+f.key);
  let stmt, cls='';
  if(!f.enough) { stmt=t('ins.small'); cls='na'; }
  else if(f.impact>=4){ stmt=`<b>${esc(w.bad)}</b>${t('col')}`+t('ins.gap',{m,d:r0(f.scoreGap),w:Math.round(f.wrGap*100)}); cls='neg'; }
  else if(f.impact<=-4){ stmt=`<b>${esc(w.bad)}</b>${t('col')}`+t('ins.better',{m,d:r0(-f.scoreGap)}); cls='pos'; }
  else stmt=t('ins.same');
  const lo=Math.min(f.good.avg??0,f.bad.avg??0)*.8, hi=Math.max(f.good.avg??1,f.bad.avg??1);
  const bar=(lab,s,k)=>`<div class="brow ${k}"><div class="bl"><span>${esc(lab)} <small>${t('ins.nd',{n:s.days})}</small></span><span class="num">${s.games?pct(s.wr):'—'} · ${r0(s.avg)}</span></div><div class="bar"><i style="width:${f.enough&&s.avg!=null?Math.max(4,(s.avg-lo)/(hi-lo||1)*100):Math.min(100,s.days*8)}%"></i></div></div>`;
  return `<div class="card fcard ${cls}"><div class="row between"><h3>${esc(w.name)}</h3><span class="muted xs">${t('ins.wr')} · ${t('ins.avg',{m})}</span></div><p class="stmt">${stmt}</p>${bar(w.good,f.good,'good')}${bar(w.bad,f.bad,'bad')}</div>`;
}

/* ---------------- THIS WEEK ---------------- */
function renderWeek(){
  const el=$('#v-week'), w=S.weekly(D());
  if(proposalIdx>=w.proposals.length) proposalIdx=0;
  const g=w.cur||w.proposals[proposalIdx], ev=S.evalWeek(g,w.ws,D()), left=Math.max(0,g.n-ev.x);
  const m=w.ins.metric;
  const whyF=g.why||g.kind, topF=w.top.find(f=>f.key===whyF);
  let lastHTML=`<p class="muted">${t('w.lastNone')}</p>`;
  if(w.last){ const le=w.lastEval, res=le.x>=le.n?'w.lastHit':le.x===le.n-1?'w.lastClose':'w.lastMiss';
    lastHTML=`<div class="row gap">${ring(le.x,le.n,56)}<div><p class="goal-t sm">${S.goalText(w.last)}</p><p class="res-${res.slice(6).toLowerCase()}">${t(res)}</p></div></div>${weekDots(le)}`; }
  el.innerHTML=`<header class="vh"><div><h1>${t('w.h')}</h1><p class="lead">${t('w.lead')}</p></div>${sampleTag()}</header>
  <div class="grid2 wk">
    <div class="col">
      <div class="card goal-card">
        <p class="eyebrow">${w.cur?t('w.goal'):t('w.propose')}</p>
        <div class="row gap goal-main">${ring(ev.x,g.n,112)}<div><p class="goal-big">${S.goalText(g)}</p><p class="muted">${w.cur?(left?t('w.left',{n:left}):t('w.hit')):S.goalWhy(g)}</p></div></div>
        ${weekDots(ev)}
        ${w.cur?`<p class="muted sm why">${S.goalWhy(g)}</p>`:`<div class="row gap">${`<button class="btn primary" data-act="lock">${t('w.lock')}</button>`}${w.proposals.length>1?`<button class="btn ghost" data-act="swap">${t('w.swap')}</button>`:''}</div>`}
        ${topF?`<div class="why-box"><span class="lbl">${t('w.why')}</span><p>${S.evidence(topF,m)}</p></div>`:''}
      </div>
      <div class="card"><h2>${t('w.top')}</h2>
        ${w.top.length?w.top.map((f,i)=>`<div class="ev"><span class="evn">${i+1}</span><div><b>${esc(raw('F.'+f.key).name)}</b><p class="muted sm">${S.evidence(f,m)}</p></div></div>`).join(''):`<p class="muted">${w.ins.need?t('ins.needP',{min:w.ins.min,have:w.ins.have}):t('w.noTop')}</p>`}
      </div>
    </div>
    <div class="col">
      <div class="card"><h2>${t('w.last')}</h2>${lastHTML}</div>
      <p class="note">${t('w.note')}</p>
    </div>
  </div>`;
}

/* ---------------- SETTINGS ---------------- */
let autostartOn=false, dataLoc='', appInfo={version:'0.1.0'};
function renderSettings(){
  const el=$('#v-settings'), s=D().settings, lp=LR.langPref;
  el.innerHTML=`<header class="vh"><div><h1>${t('s.h')}</h1></div></header>
  <div class="card set">
    <div class="srow"><div><h3>${t('s.lang')}</h3></div><div class="seg">${[['auto',t('s.auto')],['sc','简体'],['tc','繁體'],['en','EN']].map(([k,l])=>`<button data-lang="${k}" aria-pressed="${lp===k}">${l}</button>`).join('')}</div></div>
    <div class="srow"><div><h3>${t('s.startup')}</h3><p class="muted sm">${t('s.startupP')}</p></div><label class="sw"><input type="checkbox" id="swStart"${autostartOn?' checked':''}><i></i></label></div>
    <div class="srow"><div><h3>${t('s.watch')}</h3><p class="muted sm">${t('s.watchP')}</p></div><div class="col-r">
      ${['val','cs2'].map(g=>`<label class="chk"><input type="checkbox" data-watch="${g}"${s.watch[g]!==false?' checked':''}><i></i>${gameName(g)}</label>`).join('')}</div></div>
  </div>
  <div class="card set">
    <div class="srow"><div><h3>${t('s.data')}</h3><p class="muted sm">${t('s.dataP')}</p><p class="loc"><span>${t('s.loc')}</span><code>${esc(dataLoc)}</code></p></div></div>
    <div class="row gap wrap"><button class="btn ghost" data-act="export">${t('s.export')}</button>
    ${D().sampleOn?`<button class="btn ghost" data-act="sampleClear">${t('ins.sampleClear')}</button>`:`<button class="btn ghost" data-act="sample">${t('ins.sampleBtn')}</button>`}
    <button class="btn danger" data-act="wipe">${t('s.delete')}</button></div>
  </div>
  <div class="card set safety"><h3>${t('s.safety')}</h3><p class="sm">${t('s.safetyP')}</p></div>
  <div class="card set"><h3>${t('s.about')}</h3><p class="muted sm">${t('s.aboutP',{v:appInfo.version})}</p></div>`;
  $$('[data-lang]',el).forEach(b=>b.addEventListener('click',async()=>{ setLang(b.dataset.lang); await store.update(d=>{ d.settings.lang=b.dataset.lang; }); render(); }));
  $('#swStart',el).addEventListener('change',async e=>{ try{ autostartOn=await invoke('autostart_set',{on:e.target.checked}); }catch(err){ toast(esc(String(err))); autostartOn=!e.target.checked; } e.target.checked=autostartOn; });
  $$('[data-watch]',el).forEach(c=>c.addEventListener('change',()=>store.update(d=>{ d.settings.watch[c.dataset.watch]=c.checked; })));
}

/* ---------------- actions ---------------- */
async function act(a){
  if(a==='checkin') return invoke('open_window',{kind:'checkin'});
  if(a==='sample'){ await store.update(d=>S.sampleData(d)); return render(); }
  if(a==='sampleClear'){ await store.update(d=>S.clearSample(d)); return render(); }
  if(a==='lock'){ const w=S.weekly(D()); const g=Object.assign({},w.proposals[proposalIdx]||w.proposals[0],{setOn:dayKey()}); await store.update(d=>{ d.goals[w.ws]=g; }); return render(); }
  if(a==='swap'){ proposalIdx++; return render(); }
  if(a==='export'){ const p=await invoke('export_data'); if(p) toast(t('s.exported',{p})); return; }
  if(a==='wipe'){ if(!await LR.confirm(t('s.deleteQ'),t('s.delete'),true)) return; await invoke('delete_all_data'); await store.load(); toast(t('s.deleted')); return render(); }
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]'); if(b){ e.preventDefault(); act(b.dataset.act); return; }
  const d=e.target.closest('[data-del]'); if(d){ const id=d.dataset.del; await store.update(s=>{ s.matches=s.matches.filter(m=>m.id!==id); }); render(); return; }
  const go=e.target.closest('[data-go]'); if(go){ setView(go.dataset.go); return; }
});
$$('#nav button').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.open) invoke('open_window',{kind:b.dataset.open}); else setView(b.dataset.view); }));
function setView(v){
  view=v; $$('#nav button[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
  $$('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v)); render(); $('#content').scrollTop=0;
}
const R={today:renderToday,matches:renderMatches,insights:renderInsights,week:renderWeek,settings:renderSettings};
function render(){ R[view](); }
onLang(render);

/* ---------------- boot ---------------- */
(async()=>{
  applyI18n(); LR.pushLabels();
  await store.load();
  const s=D().settings; if(s.lang&&s.lang!==LR.langPref) setLang(s.lang);
  form.game=s.lastGame||S.mainGame(D());
  [autostartOn,dataLoc,appInfo,game]=await Promise.all([invoke('autostart_get').catch(()=>false),invoke('data_location').catch(()=>''),invoke('app_info').catch(()=>appInfo),invoke('game_status').catch(()=>null)]);
  gamePill($('#gamePill'),game); onLang(()=>gamePill($('#gamePill'),game));
  listen('game-status',p=>{ game=p&&p.game; gamePill($('#gamePill'),game); });
  listen('data-changed',async p=>{ if(p&&p.from==='main') return; await store.load(); render(); });
  const qv=new URLSearchParams(location.search).get('view'); if(qv&&R[qv]) setView(qv); else render();
  // day rollover / periodic refresh (week dots, "today")
  let lastDay=dayKey(); setInterval(()=>{ if(dayKey()!==lastDay){ lastDay=dayKey(); render(); } },60e3);
})();
})();
