/* LucidRank desktop: the 8-tap check-in (same question set as the concept site).
   boot(host, opts) renders into `host`: used by checkin.html (pop-up window) and, as a fallback,
   inside the main window (opts.inline). */
(function(){
'use strict';
const {$,$$,esc,t,applyI18n,invoke,listen,store,dayKey,onLang}=LR;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const AUTO_CLOSE_S=3;

// answer slots: 0 bed · 1 dur · 2 phone · 3 move · 4 gap (only if moved) · 5 meal · 6 pre (multi) · 7 caf · 8 mood
const Q=[
  {k:'bed',flag:v=>v>=3},
  {k:'dur',flag:v=>v<=1},
  {k:'phone',tag:true,flag:v=>v>=3},
  {k:'move'},
  {k:'gap',sub:true,cond:a=>a[3]>0},
  {k:'meal',flag:v=>v>=2},
  {k:'pre',multi:true,flag:v=>v.includes(2)||v.includes(3)},
  {k:'caf',flag:v=>v>=2},
  {k:'mood',faces:true,flag:v=>v===0},
];
Q.forEach(q=>{ q.n=I18N['q.'+q.k+'.o'].sc.length; });
const STEPS=Q.filter(q=>!q.sub).length;   // 8 taps (+1 follow-up when you trained)
const seg=i=>Q.slice(0,i+1).filter(q=>!q.sub).length-1;
const tag=(key,args,el='span',attrs='')=>`<${el} data-i18n="${key}"${args?` data-i18n-args="${esc(JSON.stringify(args))}"`:''}${attrs?' '+attrs:''}>${t(key,args)}</${el}>`;
const RING='<svg class="done-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="45"/><circle class="fg" cx="50" cy="50" r="45"/><path d="M34 51l11 11 21-23"/></svg>';
function face(i){
  const c=[-1,-.5,0,.6,1][i], my=27, cv=c*6;
  const eyes=i===0?'<path d="M13 17.5h5M22 17.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>':`<circle cx="15.5" cy="17" r="${i===4?2.2:1.9}" fill="currentColor"/><circle cx="24.5" cy="17" r="${i===4?2.2:1.9}" fill="currentColor"/>`;
  const col=['#8a8a92','#b9a48f','#e7e7ea','#ffc46b','#ff6a3d'][i];
  return `<svg viewBox="0 0 40 40" style="color:${col}" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="1.8"/>${eyes}<path d="M13 ${my} Q20 ${my+cv} 27 ${my}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function summary(a){
  const val=(q,i)=>q.multi?a[i].map(j=>tag('q.'+q.k+'.o#'+j)).join(tag('ci.sep')):tag('q.'+q.k+'.o#'+a[i]);
  let items=Q.map((q,i)=>[q,i]).filter(([q,i])=>a[i]!==undefined&&a[i]!==null);
  items=[...items.filter(([q])=>!q.multi),...items.filter(([q])=>q.multi)];
  return `<div class="sum">${items.map(([q,i],k)=>`<div class="${q.flag&&q.flag(a[i])?'flag':''}${q.multi?' wide':''}" style="transition-delay:${.3+k*.035}s">${tag('q.'+q.k+'.s',null,'span','class="sk"')}${val(q,i)}</div>`).join('')}</div>`;
}

function boot(host,opts={}){
  const close=opts.close||(()=>invoke('close_self'));
  host.innerHTML=`<div class="ci-win${opts.inline?' inline':''}" id="device">
    <header class="ci-head">
      <div class="ci-head-l">${tag('ci.day',null,'p','class="ci-eyebrow"')}<span class="ci-gamenote" id="ciGame" hidden></span></div>
      <div class="ci-head-r"><span class="dt-timer num" id="ciTimer"></span>${tag('ci.skip',null,'button','class="ci-skip" id="ciSkip"')}</div>
    </header>
    <div class="ci-prow"><div class="ci-progress" id="ciProg">${'<i></i>'.repeat(STEPS)}</div><span class="ci-count num" id="ciCount"></span></div>
    <div class="ci-stage" id="ciStage"></div>
    <footer class="ci-nav">${tag('ci.back',null,'button','class="ci-back" id="ciBack" disabled')}<span class="ci-foot-hint">${tag('ci.keys')} <kbd>1</kbd>–<kbd>5</kbd> · <kbd>Esc</kbd></span></footer>
  </div>`;
  const stage=$('#ciStage',host), prog=$$('#ciProg i',host), back=$('#ciBack',host), count=$('#ciCount',host), timerEl=$('#ciTimer',host), device=$('#device',host), skipBtn=$('#ciSkip',host), gn=$('#ciGame',host);
  let qi=0, ans=[], tStart=0, tRAF=0, busy=false, done=false, closeT=0, alive=true;
  const visible=i=>!Q[i].cond||Q[i].cond(ans);
  const nextIdx=i=>{ let j=i+1; while(j<Q.length&&!visible(j)) j++; return j; };
  const prevIdx=i=>{ let j=i-1; while(j>0&&!visible(j)) j--; return j; };
  const end=()=>{ if(!alive) return; alive=false; clearInterval(closeT); cancelAnimationFrame(tRAF); removeEventListener('keydown',onKey); close(); };

  function qHTML(i){
    const d=Q[i], ok='q.'+d.k+'.o', J=[...Array(d.n).keys()], a=ans[i];
    const isSel=j=>d.multi?(a||[]).includes(j):a===j;
    const opts=d.faces
      ? `<div class="faces">${J.map(j=>`<button class="face${isSel(j)?' sel':''}" data-j="${j}">${face(j)}${tag(ok+'#'+j)}<kbd>${j+1}</kbd></button>`).join('')}</div>`
      : `<div class="opts${d.multi?' multi':''}">${J.map(j=>`<button class="opt${isSel(j)?' sel':''}" data-j="${j}"${d.multi?` aria-pressed="${isSel(j)}"`:''}>${tag(ok+'#'+j)}<kbd>${j+1}</kbd></button>`).join('')}</div>`;
    const idx=String(seg(i)+1).padStart(2,'0')+(d.sub?'b':'');
    return `<div class="q-idx">${tag('ci.idx',{n:idx})}${d.tag?tag('q.tag',null,'span','class="q-tag"'):''}${d.multi?tag('ci.multi',null,'span','class="q-tag q-multi"'):''}</div>${tag('q.'+d.k,null,'h3','class="q-text"')}${opts}${d.multi?tag('ci.next',null,'button',`class="ci-next"${(a||[]).length?'':' disabled'}`):''}`;
  }
  function updProg(){
    const cs=done?STEPS:seg(qi);
    prog.forEach((p,k)=>{ p.classList.toggle('done',k<cs); p.classList.toggle('cur',!done&&k===cs); });
    back.disabled=qi===0||done; count.textContent=done?t('ci.done'):`${cs+1} / ${STEPS}`;
  }
  function swap(html,dir=1,cls='qcard'){
    $$('.qcard:not(.leave),.ci-done:not(.leave)',stage).forEach(o=>{ o.classList.add('leave'); if(dir<0) o.classList.add('back'); setTimeout(()=>o.remove(),500); });
    const c=document.createElement('div'); c.className=cls+' enter'+(dir<0?' back':''); c.innerHTML=html; stage.appendChild(c);
    requestAnimationFrame(()=>requestAnimationFrame(()=>c.classList.remove('enter','back')));
    return c;
  }
  function show(i,dir=1){ swap(qHTML(i),dir); qi=i; updProg(); }
  const setTimer=n=>{ timerEl.textContent=t('ci.sec',{n}); };
  function tick(){ setTimer(((performance.now()-tStart)/1000).toFixed(1)); tRAF=requestAnimationFrame(tick); }
  function startTimer(){ if(!tStart){ tStart=performance.now(); device.classList.add('timing'); tick(); } }
  function advance(){
    if(busy) return; busy=true;
    prog[seg(qi)].classList.add('done');
    setTimeout(()=>{ busy=false; const n=nextIdx(qi); if(n<Q.length) show(n); else finish(); }, RM?60:260);
  }
  function pick(j,btn){
    if(busy) return; startTimer();
    ans[qi]=j; if(Q[qi].k==='move'&&j===0) ans[4]=undefined;
    $$('.sel',stage).forEach(b=>b.classList.remove('sel')); btn.classList.add('sel');
    advance();
  }
  function toggle(j){
    if(busy) return; startTimer();
    let a=(ans[qi]||[]).slice();
    if(a.includes(j)) a=a.filter(x=>x!==j); else a=j===0?[0]:[...a.filter(x=>x!==0),j];
    a.sort(); ans[qi]=a;
    const card=$('.qcard:not(.leave)',stage);
    $$('.opt',card).forEach(b=>{ const on=a.includes(+b.dataset.j); b.classList.toggle('sel',on); b.setAttribute('aria-pressed',on); });
    $('.ci-next',card).disabled=!a.length;
  }
  function doneCard(title,sub,a,extra){
    const d=swap(`${RING}${title}${sub}${summary(a)}${extra}`,1,'ci-done');
    requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add('show')));
    return d;
  }
  async function finish(){
    cancelAnimationFrame(tRAF); device.classList.remove('timing');
    const secs=((performance.now()-tStart)/1000).toFixed(1); setTimer(secs);
    done=true; qi=Q.length; updProg(); skipBtn.hidden=true;
    const a=Q.map((q,i)=>visible(i)&&ans[i]!==undefined?ans[i]:null);
    const stay=new URLSearchParams(location.search).has('stay');
    const d=doneCard(tag('ci.logged',null,'h3'),tag('ci.took',{n:secs},'p','class="sub"'),a,
      `<div class="ci-closebar"><span class="ci-closing" id="ciClosing"></span><span class="grow"></span>${tag('ci.keep',null,'button','class="btn ghost sm" id="ciKeep"')}${tag(opts.inline?'ci.back2':'close',null,'button','class="btn primary sm" id="ciClose"')}</div>`);
    $('#ciClose',d).addEventListener('click',end);
    try{ await store.update(s=>{ s.checkins[dayKey()]={a,secs:+secs,at:new Date().toISOString()}; }); }
    catch(e){ console.error(e); $('#ciClosing',d).textContent=String(e); return; }
    if(stay) return;
    let left=AUTO_CLOSE_S; const lbl=$('#ciClosing',d), keep=$('#ciKeep',d);
    const upd=()=>{ lbl.textContent=t('ci.closeIn',{n:left}); };
    upd(); closeT=setInterval(()=>{ left--; if(left<=0) end(); else upd(); },1000);
    keep.addEventListener('click',()=>{ clearInterval(closeT); lbl.textContent=''; keep.hidden=true; });
  }
  function already(rec){
    done=true; updProg(); skipBtn.hidden=true; prog.forEach(p=>p.classList.add('done'));
    const d=doneCard(tag('ci.already',null,'h3'),tag('ci.alreadyP',null,'p','class="sub"'),rec.a,
      `<div class="ci-closebar center">${tag('ci.redo',null,'button','class="btn ghost sm" id="ciRedo"')}${tag(opts.inline?'ci.back2':'close',null,'button','class="btn primary sm" id="ciClose"')}</div>`);
    $('#ciRedo',d).addEventListener('click',()=>{ done=false; skipBtn.hidden=false; ans=[]; tStart=0; setTimer('0.0'); show(0,-1); });
    $('#ciClose',d).addEventListener('click',end);
  }
  function onKey(e){
    if(!host.isConnected){ removeEventListener('keydown',onKey); return; }
    if(e.target.closest&&e.target.closest('input,textarea,select,.modal')) return;
    if(e.key==='Escape'){ end(); return; }
    if(done) return;
    if(e.key==='Backspace'&&qi>0&&!busy){ show(prevIdx(qi),-1); return; }
    if(e.key==='Enter'&&Q[qi].multi&&(ans[qi]||[]).length){ e.preventDefault(); advance(); return; }
    const n=parseInt(e.key,10);
    if(n>=1&&n<=Q[qi].n){ const b=$$('.opt,.face',$('.qcard:not(.leave)',stage))[n-1]; if(b) Q[qi].multi?toggle(n-1):pick(n-1,b); }
  }
  stage.addEventListener('click',e=>{
    if(e.target.closest('.ci-next')){ if((ans[qi]||[]).length) advance(); return; }
    const b=e.target.closest('.opt,.face'); if(!b||done) return;
    Q[qi].multi?toggle(+b.dataset.j):pick(+b.dataset.j,b);
  });
  back.addEventListener('click',()=>{ if(qi>0&&!done&&!busy) show(prevIdx(qi),-1); });
  skipBtn.addEventListener('click',async()=>{ await invoke('skip_today').catch(()=>{}); end(); });
  addEventListener('keydown',onKey);
  onLang(()=>{ if(alive) updProg(); });
  const setGame=g=>{ if(!g) return; gn.hidden=false; gn.dataset.i18n='ci.game'; gn.dataset.i18nArgs=JSON.stringify({g:LR.gameName(g)}); gn.innerHTML=t('ci.game',{g:LR.gameName(g)}); };

  (async()=>{
    setTimer('0.0'); updProg();
    invoke('game_status').then(setGame).catch(()=>{});
    if(!opts.inline) listen('game-status',p=>setGame(p&&p.game));
    await store.load().catch(()=>{});
    const rec=store.data.checkins[dayKey()];
    if(rec&&rec.a) already(rec); else show(0);
    if(!opts.inline) invoke('window_ready').catch(()=>{});
  })();
  return {close:end};
}

window.LRCheckin={Q,summary,boot};
// stand-alone pop-up window
if(document.body&&document.body.classList.contains('ci-body')){ applyI18n(); boot($('#ciHost')); }
})();
