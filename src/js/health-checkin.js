/* Specific self-reporting. No diagnosis, health score, or character judgement. */
(function(){
'use strict';
const {t,raw,esc,store,dayKey,addDays}=LR;
const drafts={};
const limits={sleepHours:[0,24],alertness:[0,10],discomfort:[0,10],phoneMinutes:[0,1440],exerciseMinutes:[0,1440],practicePlanned:[0,1440],practiceDone:[0,1440],breaksPlanned:[0,100],breaksDone:[0,100]};
const dietLimits={meals:[0,12],oilyMeals:[0,12],saltyMeals:[0,12]};
const optionalLimits={recovery:[1,5],caffeineMl:[0,5000]};
const caffeineValues=['unknown','none','coffee','tea','energy','cola','mixed'];
const healthValues=['unknown','normal','unwell','recovering','fatigued'];
/* Step1 chip values → stored numbers (old schema). Midpoints keep buckets()/feedback working. */
const SLEEP_CHIPS=[{id:'lt5',hours:4},{id:'5-6',hours:5.5},{id:'6-7',hours:6.5},{id:'7-8',hours:7.5},{id:'gt8',hours:9}];
const ALERT_CHIPS=[{id:'drowsy',n:2},{id:'ok',n:5},{id:'alert',n:8}];
const TAG_IDS=[1,2,3,4,5,6]; /* indices into legacy hc.symptomOptions (skip 0 无不适) */
function sleepIdFromHours(h){
 if(h==null||!Number.isFinite(h))return '';
 if(h<5)return 'lt5';if(h<6)return '5-6';if(h<7)return '6-7';if(h<8)return '7-8';return 'gt8';
}
function alertIdFromN(n){
 if(n==null||!Number.isFinite(n))return '';
 if(n<=3)return 'drowsy';if(n<=6)return 'ok';return 'alert';
}
function discomfortYes(h){
 if(!h)return false;
 if(Array.isArray(h.symptoms)&&h.symptoms.some(i=>i>0))return true;
 return h.discomfort!=null&&h.discomfort>0;
}
function valid(h){
 if(!h||h.version!==1||!healthValues.includes(h.health)||![false,true].includes(h.plannedBefore)||!Array.isArray(h.symptoms)||h.symptoms.some(x=>!Number.isInteger(x)||x<0||x>6)||h.symptoms.includes(0)&&h.symptoms.length>1||!Number.isInteger(h.reason)||h.reason<0||h.reason>5)return false;
 for(const [k,[lo,hi]] of Object.entries(limits)){const v=h[k];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||k.startsWith('breaks')&&!Number.isInteger(v)))return false;}
 for(const [k,[lo,hi]] of Object.entries(dietLimits)){const v=h[k];if(v!=null&&(!Number.isInteger(v)||v<lo||v>hi))return false;}
 for(const [k,[lo,hi]] of Object.entries(optionalLimits)){const v=h[k];if(v!=null&&(!Number.isInteger(v)||v<lo||v>hi))return false;}
 if(h.caffeineType!=null&&!caffeineValues.includes(h.caffeineType))return false;
 if(h.caffeineTime!=null&&(typeof h.caffeineTime!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(h.caffeineTime)||!Number.isFinite(Date.parse(h.caffeineTime))))return false;
 if(h.caffeineType==='none'&&(h.caffeineMl>0||h.caffeineTime!=null))return false;
 if(h.meals!=null&&['oilyMeals','saltyMeals'].some(k=>h[k]!=null&&h[k]>h.meals))return false;
 if(h.fullness!=null&&(!Number.isInteger(h.fullness)||h.fullness<0||h.fullness>4))return false;
 return ['bedtime','wakeTime'].every(k=>h[k]===null||typeof h[k]==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(h[k]));
}
// Projection only for existing coarse habit charts. Unasked questions stay null.
function buckets(h){
 let bed=null;if(h.bedtime){const [hr,m]=h.bedtime.split(':').map(Number),v=hr+m/60;bed=v>=12?(v<23?0:1):v<1?2:v<2?3:4;}
 const s=h.sleepHours,p=h.phoneMinutes,e=h.exerciseMinutes;
 return [bed,s==null?null:s<5?0:s<6?1:s<7?2:s<8?3:4,p==null?null:p===0?0:p<15?1:p<=30?2:3,e==null?null:e===0?0:1,null,null,null,null,null];
}
function labelSleep(h){
 const id=sleepIdFromHours(h.sleepHours);if(!id)return t('hc.missing');
 const i=SLEEP_CHIPS.findIndex(c=>c.id===id);return esc(raw('status_sleepOptions')[i]||'');
}
function labelAlert(h){
 const id=alertIdFromN(h.alertness);if(!id)return t('hc.missing');
 const i=ALERT_CHIPS.findIndex(c=>c.id===id);return esc(raw('status_alertOptions')[i]||'');
}
function labelDiscomfort(h){
 if(!discomfortYes(h)&&(h.discomfort==null||h.discomfort===0)&&!(h.symptoms||[]).length){
  /* explicit 无 vs unanswered: treat symptoms [0] or discomfort===0 as 无; all-null as missing */
  if(h.discomfort===0||(h.symptoms||[]).includes(0))return esc(raw('status_discomfortOptions')[0]);
  return t('hc.missing');
 }
 if(!discomfortYes(h))return esc(raw('status_discomfortOptions')[0]);
 const tags=(h.symptoms||[]).filter(i=>i>0).map(i=>esc(raw('status_discomfort_tagsOptions')[i-1]||raw('hc.symptomOptions')[i]));
 return esc(raw('status_discomfortOptions')[1])+(tags.length?' · '+tags.join(' / '):'');
}
function feedback(h,data=store.data,day=dayKey()){
 const p=s=>`<p>${s}</p>`,list=[];
 list.push(`${t('status_sleep')}: ${labelSleep(h)}`);
 list.push(`${t('status_alert')}: ${labelAlert(h)}`);
 list.push(`${t('status_discomfort')}: ${labelDiscomfort(h)}`);
 const previous=Array.from({length:7},(_,i)=>data.checkins[addDays(day,-i-1)]).filter(r=>r&&!r.sample&&r.healthLog&&valid(r.healthLog)&&r.healthLog.sleepHours!=null).map(r=>r.healthLog.sleepHours);
 let trend=t('hc.noBaseline');if(h.sleepHours!=null&&previous.length>=3){const gap=h.sleepHours-previous.reduce((a,b)=>a+b,0)/previous.length;trend=t('hc.baseline',{delta:(gap>=0?'+':'')+gap.toFixed(1),n:previous.length});}
 const caffeine=`${t('hc.caffeine')}: ${esc(raw('hc.caffeineOptions')[Math.max(0,caffeineValues.indexOf(h.caffeineType))])}${h.caffeineMl==null?'':' · '+h.caffeineMl+' ml'}${h.caffeineTime?' · '+esc(h.caffeineTime.replace('T',' ')):''}`;
 const diet=`${p(caffeine)}<h3>${t('hc.diet')}</h3>${p(t('hc.dietCounts',{meals:h.meals??t('hc.missing'),oily:h.oilyMeals??t('hc.missing'),salty:h.saltyMeals??t('hc.missing')}))}${p(t('hc.fullness')+': '+esc(raw('hc.fullnessOptions')[h.fullness??0]))}${p(t('hc.dietFeedback'))}`;
 const tasks=[['practicePlanned','practiceDone','hc.completed'],['breaksPlanned','breaksDone','hc.breakDone']].filter(([a,b])=>h[a]!=null&&h[b]!=null);
 const active=tasks.filter(([a])=>h[a]>0),hits=active.filter(([a,b])=>h[b]>=h[a]).length;
 const adjusted=['unwell','recovering'].includes(h.health)||[1,3].includes(h.reason)||h.discomfort>0||h.symptoms.some(i=>i>0);
 let execution=!h.plannedBefore||!active.length?t('hc.noPlan'):t('hc.ratio',{hit:hits,total:active.length});
 execution+=tasks.map(([a,b,name])=>p(t('hc.task',{name:t(name),done:h[b],planned:h[a]})+(h[a]===0?' '+t('hc.rest'):''))).join('');
 execution+=p(adjusted?t('hc.adjust'):h.plannedBefore&&active.length&&hits===active.length?t('hc.good'):t('hc.next'));
 return `<section class="hc-feedback"><h3>${t('hc.body')}</h3>${list.map(p).join('')}${p(trend)}${diet}<h3>${t('hc.execution')}</h3>${execution}${p(t('hc.note'))}</section>`;
}
function boot(host,opts={}){
 let alive=true;const day=dayKey(),close=opts.close||(()=>LR.invoke('close_self'));
 host.innerHTML=`<div class="hc-wrap"><img class="routine-banner" src="images/urban-banner.svg" width="1200" height="240" alt="" loading="lazy" decoding="async"><h2>${t('hc.title')}</h2><p>${t('status_disclaimer')}</p><div class="hc-content"></div></div>`;
 const content=host.querySelector('.hc-content');
 const field=(key,name,type='number',value=null)=>`<label>${t(key)}<input name="${name}" type="${type}" ${type==='number'?`min="${(limits[name]||dietLimits[name]||optionalLimits[name])[0]}" max="${(limits[name]||dietLimits[name]||optionalLimits[name])[1]}" step="${name==='sleepHours'?'.25':name.startsWith('breaks')?'1':'1'}"`:''} value="${esc(value==null?'':String(value))}"></label>`;
 const select=(key,name,values,h)=>`<label>${t(key)}<select name="${name}">${raw(key+'Options').map((v,i)=>`<option value="${values[i]}" ${String(h[name])===String(values[i])?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
 const chipGroup=(legendKey,name,chips,selected,multi=false)=>{
  const opts=raw(legendKey+'Options');
  return `<fieldset class="hc-chip-group" data-chip-name="${name}"${multi?' data-multi="1"':''}><legend>${t(legendKey)}</legend><div class="chips" role="group" aria-label="${esc(t(legendKey))}">${chips.map((c,i)=>`<button type="button" class="chip" data-chip="${esc(c)}" aria-pressed="${multi?(selected||[]).includes(c):selected===c}">${esc(opts[i])}</button>`).join('')}</div></fieldset>`;
 };
 function form(h={}){
  const sleepSel=sleepIdFromHours(h.sleepHours);
  const alertSel=alertIdFromN(h.alertness);
  const discYes=discomfortYes(h);
  const discSel=h.discomfort==null&&!(h.symptoms||[]).length&&!discYes?'':(discYes?'yes':'no');
  const tagSel=(h.symptoms||[]).filter(i=>i>0);
  content.innerHTML=`<form class="hc-form"><p class="hc-estimate">${t('hc.estimate')}</p>
<div class="hc-body-step">
${chipGroup('status_sleep','sleep',SLEEP_CHIPS.map(c=>c.id),sleepSel)}
${chipGroup('status_alert','alert',ALERT_CHIPS.map(c=>c.id),alertSel)}
${chipGroup('status_discomfort','discomfort',['no','yes'],discSel)}
<div class="hc-tag-wrap"${discSel==='yes'?'':' hidden'}">${chipGroup('status_discomfort_tags','tags',TAG_IDS.map(String),tagSel.map(String),true)}</div>
</div>
<details class="hc-diet"><summary>${t('hc.diet')}</summary><p>${t('hc.dietNote')}</p><p>${t('hc.examples')}</p><div class="hc-grid">${field('hc.meals','meals','number',h.meals)}${field('hc.oily','oilyMeals','number',h.oilyMeals)}${field('hc.salty','saltyMeals','number',h.saltyMeals)}${select('hc.fullness','fullness',[0,1,2,3,4],h)}${select('hc.caffeine','caffeineType',caffeineValues,h)}${field('hc.caffeineMl','caffeineMl','number',h.caffeineMl)}${field('hc.caffeineTime','caffeineTime','datetime-local',h.caffeineTime)}</div><p>${t('hc.caffeineNote')}</p></details>
<h3>${t('hc.plan')}</h3><p>${t('hc.selfPlan')}</p><div class="hc-grid">${select('hc.before','plannedBefore',['false','true'],h)}${field('hc.planned','practicePlanned','number',h.practicePlanned)}${field('hc.completed','practiceDone','number',h.practiceDone)}${field('hc.breakPlanned','breaksPlanned','number',h.breaksPlanned)}${field('hc.breakDone','breaksDone','number',h.breaksDone)}${select('hc.reason','reason',[0,1,2,3,4,5],h)}</div>
<p class="hc-error" role="alert"></p><button type="submit" class="btn primary">${t('hc.save')}</button> <button type="button" class="btn ghost hc-close">${t('close')}</button></form>`;
  const f=content.querySelector('form');
  const tagWrap=f.querySelector('.hc-tag-wrap');
  const pressed=(group,id)=>group.querySelector(`[data-chip="${CSS.escape(String(id))}"]`)?.getAttribute('aria-pressed')==='true';
  const readBody=()=>{
   const sleepG=f.querySelector('[data-chip-name="sleep"]');
   const alertG=f.querySelector('[data-chip-name="alert"]');
   const discG=f.querySelector('[data-chip-name="discomfort"]');
   const tagG=f.querySelector('[data-chip-name="tags"]');
   let sleepHours=null;for(const c of SLEEP_CHIPS){if(pressed(sleepG,c.id)){sleepHours=c.hours;break;}}
   let alertness=null;for(const c of ALERT_CHIPS){if(pressed(alertG,c.id)){alertness=c.n;break;}}
   let discomfort=null,symptoms=[],health='unknown';
   if(pressed(discG,'no')){discomfort=0;symptoms=[];}
   else if(pressed(discG,'yes')){
    discomfort=5;symptoms=[];
    for(const id of TAG_IDS){if(pressed(tagG,id))symptoms.push(id);}
    health=symptoms.length?'unwell':'unknown';
   }
   return {sleepHours,alertness,discomfort,symptoms,health};
  };
  const read=()=>{
   const d=new FormData(f),body=readBody();
   const o={
    version:1,
    health:body.health,
    plannedBefore:d.get('plannedBefore')==='true',
    symptoms:body.symptoms,
    reason:Number(d.get('reason')),
    bedtime:null,
    wakeTime:null,
    phoneMinutes:null,
    exerciseMinutes:null,
    recovery:null,
    fullness:Number(d.get('fullness')),
    caffeineType:d.get('caffeineType'),
    caffeineMl:!d.get('caffeineMl')?null:Number(d.get('caffeineMl')),
    caffeineTime:d.get('caffeineTime')||null,
    sleepHours:body.sleepHours,
    alertness:body.alertness,
    discomfort:body.discomfort
   };
   for(const k of Object.keys(dietLimits))o[k]=d.get(k)===''?null:Number(d.get(k));
   for(const k of ['practicePlanned','practiceDone','breaksPlanned','breaksDone'])o[k]=d.get(k)===''?null:Number(d.get(k));
   return o;
  };
  const caffeineState=()=>{const none=f.elements.caffeineType.value==='none';for(const k of ['caffeineMl','caffeineTime']){f.elements[k].disabled=none;if(none)f.elements[k].value='';}};caffeineState();f.elements.caffeineType.addEventListener('change',caffeineState);
  f.addEventListener('click',e=>{
   const b=e.target.closest('.chip[data-chip]');if(!b)return;
   const group=b.closest('[data-chip-name]');if(!group)return;
   const multi=group.dataset.multi==='1';
   if(multi){
    b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')==='true'?'false':'true');
   }else{
    const on=b.getAttribute('aria-pressed')!=='true';
    group.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed','false'));
    if(on)b.setAttribute('aria-pressed','true');
    if(group.dataset.chipName==='discomfort'){
     const yes=pressed(group,'yes');
     tagWrap.hidden=!yes;
     if(!yes)tagWrap.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed','false'));
    }
   }
   drafts[day]=read();
  });
  f.addEventListener('input',()=>{drafts[day]=read();});
  f.addEventListener('change',()=>{drafts[day]=read();});
  f.querySelector('.hc-close').onclick=()=>{alive=false;close();};
  f.onsubmit=async e=>{e.preventDefault();const h=read(),error=f.querySelector('.hc-error');if(!valid(h)){error.textContent=t(h.meals!=null&&['oilyMeals','saltyMeals'].some(k=>h[k]!=null&&h[k]>h.meals)?'hc.dietError':'hc.error');return;}const b=f.querySelector('[type="submit"]');b.disabled=true;try{await store.update(s=>{const prior=s.checkins[day];if(prior&&prior.healthLog&&prior.healthLog.plannedBefore&&['practicePlanned','breaksPlanned'].some(k=>prior.healthLog[k]!==h[k]))h.plannedBefore=false;s.checkins[day]={...(prior&&!prior.sample?prior:{}),schemaVersion:3,a:buckets(h),healthLog:h,at:new Date().toISOString(),sample:false};});delete drafts[day];if(alive&&host.isConnected)show(h);}catch(err){error.textContent=String(err);b.disabled=false;}};
 }
 function show(h){content.innerHTML=feedback(h)+`<button class="btn primary hc-edit">${t('hc.edit')}</button> <button class="btn ghost hc-close">${t('close')}</button>`;content.querySelector('.hc-edit').onclick=()=>form(h);content.querySelector('.hc-close').onclick=()=>{alive=false;close();};}
 (async()=>{await store.load().catch(()=>{});if(!alive||!host.isConnected)return;const r=store.data.checkins[day];if(drafts[day])form(drafts[day]);else if(r&&r.healthLog&&valid(r.healthLog))show(r.healthLog);else form();if(!opts.inline)LR.invoke('window_ready').catch(()=>{});})();
 return {close(){alive=false;close();}};
}
window.LRHealth={valid,buckets,feedback,boot};
LRCheckin.boot=boot;
// Initialize standalone check-in windows.
if(document.body.classList.contains('ci-body')){const h=document.querySelector('#ciHost');if(h)boot(h);}
})();
