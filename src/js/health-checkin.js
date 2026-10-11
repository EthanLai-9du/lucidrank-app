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
function feedback(h,data=store.data,day=dayKey()){
 const p=s=>`<p>${s}</p>`,list=[];
 list.push(h.sleepHours==null?t('hc.missing'):t('hc.sleepValue',{n:h.sleepHours}));
 list.push(`${t('hc.recovery')}: ${esc(raw('hc.recoveryOptions')[h.recovery??0])}`);
 list.push(`${t('hc.health')}: ${esc(raw('hc.healthOptions')[healthValues.indexOf(h.health)])}`);
 for(const k of ['alertness','discomfort'])list.push(`${t(k==='alertness'?'hc.energy':'hc.discomfort')}: ${h[k]==null?t('hc.missing'):h[k]+'/10'}`);
 list.push(`${t('hc.symptoms')}: ${h.symptoms.length?h.symptoms.map(i=>esc(raw('hc.symptomOptions')[i])).join(' / '):t('hc.missing')}`);
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
 host.innerHTML=`<div class="hc-wrap"><img class="routine-banner" src="images/urban-banner.svg" width="1200" height="240" alt="" loading="lazy" decoding="async"><h2>${t('hc.title')}</h2><p>${t('hc.note')}</p><div class="hc-content"></div></div>`;
 const content=host.querySelector('.hc-content');
 const field=(key,name,type='number',value=null)=>`<label>${t(key)}<input name="${name}" type="${type}" ${type==='number'?`min="${(limits[name]||dietLimits[name]||optionalLimits[name])[0]}" max="${(limits[name]||dietLimits[name]||optionalLimits[name])[1]}" step="${name==='sleepHours'?'.25':name.startsWith('breaks')?'1':'1'}"`:''} value="${esc(value==null?'':String(value))}"></label>`;
 const select=(key,name,values,h)=>`<label>${t(key)}<select name="${name}">${raw(key+'Options').map((v,i)=>`<option value="${values[i]}" ${String(h[name])===String(values[i])?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
 function form(h={}){
 content.innerHTML=`<form class="hc-form"><p>${t('hc.estimate')}</p><div class="hc-grid">${field('hc.sleep','sleepHours','number',h.sleepHours)}${select('hc.recovery','recovery',['',1,2,3,4,5],h)}${field('hc.bed','bedtime','time',h.bedtime)}${field('hc.wake','wakeTime','time',h.wakeTime)}${select('hc.health','health',healthValues,h)}${field('hc.energy','alertness','number',h.alertness)}${field('hc.discomfort','discomfort','number',h.discomfort)}${field('hc.phone','phoneMinutes','number',h.phoneMinutes)}${field('hc.exercise','exerciseMinutes','number',h.exerciseMinutes)}</div><fieldset><legend>${t('hc.symptoms')}</legend>${raw('hc.symptomOptions').map((v,i)=>`<label class="hc-symptom"><input type="checkbox" name="symptoms" value="${i}" ${(h.symptoms||[]).includes(i)?'checked':''}>${esc(v)}</label>`).join('')}</fieldset><details class="hc-diet"><summary>${t('hc.diet')}</summary><p>${t('hc.dietNote')}</p><p>${t('hc.examples')}</p><div class="hc-grid">${field('hc.meals','meals','number',h.meals)}${field('hc.oily','oilyMeals','number',h.oilyMeals)}${field('hc.salty','saltyMeals','number',h.saltyMeals)}${select('hc.fullness','fullness',[0,1,2,3,4],h)}${select('hc.caffeine','caffeineType',caffeineValues,h)}${field('hc.caffeineMl','caffeineMl','number',h.caffeineMl)}${field('hc.caffeineTime','caffeineTime','datetime-local',h.caffeineTime)}</div><p>${t('hc.caffeineNote')}</p></details><h3>${t('hc.plan')}</h3><p>${t('hc.selfPlan')}</p><div class="hc-grid">${select('hc.before','plannedBefore',['false','true'],h)}${field('hc.planned','practicePlanned','number',h.practicePlanned)}${field('hc.completed','practiceDone','number',h.practiceDone)}${field('hc.breakPlanned','breaksPlanned','number',h.breaksPlanned)}${field('hc.breakDone','breaksDone','number',h.breaksDone)}${select('hc.reason','reason',[0,1,2,3,4,5],h)}</div><p class="hc-error" role="alert"></p><button type="submit" class="btn primary">${t('hc.save')}</button> <button type="button" class="btn ghost hc-close">${t('close')}</button></form>`;
 const f=content.querySelector('form');
 const read=()=>{const d=new FormData(f),o={version:1,health:d.get('health'),plannedBefore:d.get('plannedBefore')==='true',symptoms:d.getAll('symptoms').map(Number),reason:Number(d.get('reason')),bedtime:d.get('bedtime')||null,wakeTime:d.get('wakeTime')||null,fullness:Number(d.get('fullness')),recovery:d.get('recovery')===''?null:Number(d.get('recovery')),caffeineType:d.get('caffeineType'),caffeineMl:!d.get('caffeineMl')?null:Number(d.get('caffeineMl')),caffeineTime:d.get('caffeineTime')||null};for(const k of Object.keys({...limits,...dietLimits}))o[k]=d.get(k)===''?null:Number(d.get(k));return o;};
 const caffeineState=()=>{const none=f.elements.caffeineType.value==='none';for(const k of ['caffeineMl','caffeineTime']){f.elements[k].disabled=none;if(none)f.elements[k].value='';}};caffeineState();f.elements.caffeineType.addEventListener('change',caffeineState);
 f.addEventListener('input',()=>{drafts[day]=read();});
 f.addEventListener('change',e=>{if(e.target.name==='symptoms'&&e.target.checked){for(const b of f.querySelectorAll('[name="symptoms"]'))if(b!==e.target&&(e.target.value==='0'||b.value==='0'))b.checked=false;}drafts[day]=read();});
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
