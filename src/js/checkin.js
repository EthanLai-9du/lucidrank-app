/* LucidRank desktop: the 8-tap check-in (same question set as the concept site). */
(function(){
'use strict';
const {$,$$,esc,t,applyI18n,invoke,listen,store,dayKey,onLang}=LR;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;

// answer slots: 0 bed · 1 dur · 2 phone · 3 move · 4 gap (only if moved) · 5 meal · 6 pre (multi) · 7 caf · 8 mood
const Q=[
  {k:'bed',flag:v=>v>=3},
  {k:'dur',flag:v=>v<=1},
  {k:'phone',tag:true,flag:v=>v>=3},
  {k:'move'},
  {k:'gap',sub:true,cond:()=>ans[3]>0},
  {k:'meal',flag:v=>v>=2},
  {k:'pre',multi:true,flag:v=>v.includes(2)||v.includes(3)},
  {k:'caf',flag:v=>v>=2},
  {k:'mood',faces:true,flag:v=>v===0},
];
Q.forEach(q=>{ q.n=I18N['q.'+q.k+'.o'].sc.length; });
const STEPS=Q.filter(q=>!q.sub).length;   // 8 taps (+1 follow-up when you trained)
const seg=i=>Q.slice(0,i+1).filter(q=>!q.sub).length-1;
const tag=(key,args,el='span',attrs='')=>`<${el} data-i18n="${key}"${args?` data-i18n-args="${esc(JSON.stringify(args))}"`:''}${attrs?' '+attrs:''}>${t(key,args)}</${el}>`;

const stage=$('#ciStage'), prog=$$('#ciProg i'), back=$('#ciBack'), count=$('#ciCount'), timerEl=$('#ciTimer'), device=$('#device'), skipBtn=$('#ciSkip');
let qi=0, ans=[], tStart=0, tRAF=0, busy=false, done=false;
const visible=i=>!Q[i].cond||Q[i].cond();
const nextIdx=i=>{ let j=i+1; while(j<Q.length&&!visible(j)) j++; return j; };
const prevIdx=i=>{ let j=i-1; while(j>0&&!visible(j)) j--; return j; };

function face(i){
  const c=[-1,-.5,0,.6,1][i], my=27, cv=c*6;
  const eyes=i===0?'<path d="M13 17.5h5M22 17.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>':`<circle cx="15.5" cy="17" r="${i===4?2.2:1.9}" fill="currentColor"/><circle cx="24.5" cy="17" r="${i===4?2.2:1.9}" fill="currentColor"/>`;
  const col=['#8a8a92','#b9a48f','#e7e7ea','#ffc46b','#ff6a3d'][i];
  return `<svg viewBox="0 0 40 40" style="color:${col}" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="1.8"/>${eyes}<path d="M13 ${my} Q20 ${my+cv} 27 ${my}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function qHTML(i){
  const d=Q[i], ok='q.'+d.k+'.o', J=[...Array(d.n).keys()], a=ans[i];
  const isSel=j=>d.multi?(a||[]).includes(j):a===j;
  const opts=d.faces
    ? `<div class="faces">${J.map(j=>`<button class="face${isSel(j)?' sel':''}" data-j="${j}">${face(j)}${tag(ok+'#'+j)}<kbd>${j+1}</kbd></button>`).join('')}</div>`
    : `<div class="opts${d.multi?' multi':''}">${J.map(j=>`<button class="opt${isSel(j)?' sel':''}" data-j="${j}"${d.multi?` aria-pressed="${isSel(j)}"`:''}>${tag(ok+'#'+j)}<kbd>${j+1}</kbd></button>`).join('')}</div>`;
  const idx=String(seg(i)+1).padStart(2,'0')+(d.sub?'b':'');
  return `<div class="q-idx">${tag('ci.idx',{n:idx})}${d.tag?tag('q.tag',null,'span','class="q-tag"'):''}${d.multi?tag('ci.multi',null,'span','class="q-tag q-multi"'):''}<span class="q-hint">${tag('ci.keys')} <kbd>1</kbd>–<kbd>${d.n}</kbd>${d.multi?' · <kbd>Enter</kbd>':''}</span></div>${tag('q.'+d.k,null,'h3','class="q-text"')}${opts}${d.multi?tag('ci.next',null,'button',`class="ci-next"${(a||[]).length?'':' disabled'}`):''}`;
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
  setTimeout(()=>{ busy=false; const n=nextIdx(qi); if(n<Q.length) show(n); else finish(); }, RM?60:300);
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
function summary(a){
  const val=(q,i)=>q.multi?a[i].map(j=>tag('q.'+q.k+'.o#'+j)).join(tag('ci.sep')):tag('q.'+q.k+'.o#'+a[i]);
  let items=Q.map((q,i)=>[q,i]).filter(([q,i])=>a[i]!==undefined&&a[i]!==null);
  items=[...items.filter(([q])=>!q.multi),...items.filter(([q])=>q.multi)];
  return `<div class="sum">${items.map(([q,i],k)=>`<div class="${q.flag&&q.flag(a[i])?'flag':''}${q.multi?' wide':''}" style="transition-delay:${.35+k*.04}s">${tag('q.'+q.k+'.s',null,'span','class="sk"')}${val(q,i)}</div>`).join('')}</div>`;
}
async function finish(){
  cancelAnimationFrame(tRAF); device.classList.remove('timing');
  const secs=((performance.now()-tStart)/1000).toFixed(1); setTimer(secs);
  done=true; qi=Q.length; updProg(); skipBtn.hidden=true;
  const a=Q.map((q,i)=>visible(i)&&ans[i]!==undefined?ans[i]:null);
  const d=swap(`<svg class="done-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="45"/><circle class="fg" cx="50" cy="50" r="45"/><path d="M34 51l11 11 21-23"/></svg>
    ${tag('ci.logged',null,'h3')}${tag('ci.took',{n:secs},'p','class="sub"')}${summary(a)}${tag('ci.closing',null,'p','class="ci-closing"')}`,1,'ci-done');
  requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add('show')));
  try{ await store.update(s=>{ s.checkins[dayKey()]={a,secs:+secs,at:new Date().toISOString()}; }); }catch(e){ console.error(e); }
  if(!new URLSearchParams(location.search).has('stay')) setTimeout(()=>invoke('close_self'),2600);
}
function already(rec){
  done=true; updProg(); skipBtn.hidden=true; prog.forEach(p=>p.classList.add('done'));
  const d=swap(`<svg class="done-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="45"/><circle class="fg" cx="50" cy="50" r="45"/><path d="M34 51l11 11 21-23"/></svg>
    ${tag('ci.already',null,'h3')}${tag('ci.alreadyP',null,'p','class="sub"')}${summary(rec.a)}
    <div class="row gap center">${tag('ci.redo',null,'button','class="btn" id="ciRedo"')}${tag('close',null,'button','class="btn ghost" id="ciClose"')}</div>`,1,'ci-done');
  requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add('show')));
  $('#ciRedo',d).addEventListener('click',()=>{ done=false; skipBtn.hidden=false; ans=[]; tStart=0; setTimer('0.0'); show(0,-1); });
  $('#ciClose',d).addEventListener('click',()=>invoke('close_self'));
}

stage.addEventListener('click',e=>{
  if(e.target.closest('.ci-next')){ if((ans[qi]||[]).length) advance(); return; }
  const b=e.target.closest('.opt,.face'); if(!b||done) return;
  Q[qi].multi?toggle(+b.dataset.j):pick(+b.dataset.j,b);
});
back.addEventListener('click',()=>{ if(qi>0&&!done&&!busy) show(prevIdx(qi),-1); });
skipBtn.addEventListener('click',async()=>{ await invoke('skip_today'); invoke('close_self'); });
addEventListener('keydown',e=>{
  if(e.key==='Escape'){ invoke('close_self'); return; }
  if(done) return;
  if(e.key==='Backspace'&&qi>0&&!busy){ show(prevIdx(qi),-1); return; }
  if(e.key==='Enter'&&Q[qi].multi&&(ans[qi]||[]).length){ e.preventDefault(); advance(); return; }
  const n=parseInt(e.key,10);
  if(n>=1&&n<=Q[qi].n){ const b=$$('.opt,.face',$('.qcard:not(.leave)',stage))[n-1]; if(b) Q[qi].multi?toggle(n-1):pick(n-1,b); }
});
onLang(updProg);

(async()=>{
  applyI18n(); setTimer('0.0');
  const g=await invoke('game_status').catch(()=>null);
  const gn=$('#ciGame'); if(g){ gn.hidden=false; gn.dataset.i18n='ci.game'; gn.dataset.i18nArgs=JSON.stringify({g:LR.gameName(g)}); gn.innerHTML=t('ci.game',{g:LR.gameName(g)}); }
  listen('game-status',p=>{ if(p&&p.game){ gn.hidden=false; gn.dataset.i18n='ci.game'; gn.dataset.i18nArgs=JSON.stringify({g:LR.gameName(p.game)}); gn.innerHTML=t('ci.game',{g:LR.gameName(p.game)}); } });
  await store.load();
  const rec=store.data.checkins[dayKey()];
  if(rec&&rec.a) already(rec); else show(0);
})();
window.LRCheckin={Q,summary};
})();
