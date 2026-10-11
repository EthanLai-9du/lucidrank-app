/* LucidRank desktop: insights, rule-based weekly advice, and sample data. No AI, no network. */
(function(){
'use strict';
const {t,raw,dayKey,addDays,weekStart,weekDays,uid}=LR;

const MIN_DAYS=30, MIN_SIDE=15, IMPACT_MIN=4, LOOKBACK=42;
// answer slots: 0 bed · 1 dur · 2 phone · 3 move · 4 gap · 5 meal · 6 pre · 7 caf · 8 mood
const FACTORS={
  dur:  {i:1, bad:v=>v<=1, good:v=>v>=3},     // <6h vs >=7h (6–7h left out)
  bed:  {i:0, bad:v=>v>=3, good:v=>v<=2},     // after 1 am vs before
  phone:{i:2, bad:v=>v===3, good:v=>v<=2},    // >30 min vs not
  move: {i:3, bad:v=>v===0, good:v=>v>0},     // none vs any
  caf:  {i:7, bad:v=>v===2, good:v=>v<=1},    // 2+ vs 0–1
};
const metric=g=>LRCatalog.metricLabel(g);
const num=v=>typeof v==='number'&&isFinite(v);

function mainGame(data){
  const n={val:0,cs2:0}; data.matches.forEach(m=>{ if(!m.sample&&n[m.game]!==undefined) n[m.game]++; });
  return n.cs2>n.val?'cs2':'val';
}
// Data validity and comparability are separate from causal inference.
function validMatch(m){
 if(!['W','L','D'].includes(m.result)||!['val','cs2'].includes(m.game)||m.metricType&&!['performanceScore','acs','adr','trackerScore'].includes(m.metricType))return false;
 const limits={k:[0,999],d:[0,999],a:[0,999],rounds:[1,100],rr:[-100,100],hs:[0,100],kast:[0,100],damageDealt:[0,100000],damageReceived:[0,100000],firstKills:[0,100],firstDeaths:[0,100],clutches:[0,100],trades:[0,100],trackerScore:[0,1000],adr:[0,999],damageDelta:[-999,999],pressure:[0,10],sessionMinutes:[0,1440],warmupMinutes:[0,1440],score:[0,LRCatalog.metricType(m)==='performanceScore'?500:999]};
 for(const [k,[lo,hi]] of Object.entries(limits)){const v=m[k];if(v!=null&&(!num(v)||v<lo||v>hi||(!['score','hs','kast','adr','damageDelta'].includes(k)&&!Number.isInteger(v))))return false;}
 for(const [k,values] of Object.entries({rested:['yes','no'],warmupType:['none','range','dm','aim','mixed'],reportTiming:['pre','post'],anomalyStatus:['none','yes']}))if(m[k]!=null&&!values.includes(m[k]))return false;
 if(m.anomalies!=null&&(!Array.isArray(m.anomalies)||new Set(m.anomalies).size!==m.anomalies.length||m.anomalies.some(x=>!['stutter','packetLoss','disconnect','interruption','other'].includes(x))))return false;
 if(m.anomalies?.length&&m.anomalyStatus!=='yes')return false;
 if(m.warmupType==='none'&&m.warmupMinutes>0)return false;
 if(m.stateRecordedAt!=null&&(typeof m.stateRecordedAt!=='string'||!Number.isFinite(Date.parse(m.stateRecordedAt))))return false;
 if(m.firstKills!=null&&m.k!=null&&m.firstKills>m.k||m.firstDeaths!=null&&m.d!=null&&m.firstDeaths>m.d)return false;
 if((m.damageDealt!=null||m.damageReceived!=null)&&!(m.rounds>0))return false;
 if(m.rounds&&['firstKills','firstDeaths','clutches'].some(k=>m[k]>m.rounds))return false;
 return true;
}
const contextKeys=['agent','role','mode','map','patch','rank','party','metricType'];
function comparable(m,game,filters={},includeUnwell=false){
 if(m.sample||m.game!==game||!validMatch(m)||!m.mode||!m.map||!m.patch||!m.party||!m.rank||game==='val'&&(!m.agent||!m.role))return false;
 if(includeUnwell?!['normal','unwell','recovering','fatigued'].includes(m.health):m.health!=='normal')return false;
 return contextKeys.every(k=>!filters[k]||(k==='metricType'?LRCatalog.metricType(m):m[k])===filters[k]);
}
function chosenContext(data,game,filters={}){
 // Default to the largest fully recorded context, never pool different agents or score types.
 const groups=new Map();
 for(const m of data.matches){if(!comparable(m,game,filters))continue;const key=JSON.stringify(contextKeys.map(k=>k==='metricType'?LRCatalog.metricType(m):m[k]||''));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
 const best=[...groups.values()].sort((a,b)=>new Set(b.map(m=>m.day)).size-new Set(a.map(m=>m.day)).size)[0];
 return best?Object.fromEntries(contextKeys.map(k=>[k,k==='metricType'?LRCatalog.metricType(best[0]):best[0][k]||''])):filters;
}
function joinDays(data,game,lookback,filters={},includeUnwell=false){
 const today=dayKey(),from=lookback?addDays(today,-lookback):'0000',by={};
 data.matches.forEach(m=>{if(m.day<from||m.day>today||!comparable(m,game,filters,includeUnwell))return;const c=data.checkins[m.day];if(!c||c.sample||!c.a)return;if(c.healthLog){const h=c.healthLog;if(!window.LRHealth||!LRHealth.valid(h)||h.health==='unknown')return;if(!includeUnwell&&(h.health!=='normal'||h.discomfort>0||h.symptoms.some(i=>i>0)))return;}(by[m.day]=by[m.day]||[]).push(m);});
 return Object.keys(by).sort().map(d=>({day:d,a:data.checkins[d].a,matches:by[d]}));
}
function dayScore(d){const xs=d.matches.map(m=>m.score).filter(num);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
function agg(days){
 const ms=days.flatMap(d=>d.matches),sc=days.map(dayScore).filter(num),wins=ms.filter(m=>m.result==='W').length;
 const pairs=ms.filter(m=>num(m.k)&&num(m.d));const k=pairs.reduce((a,m)=>a+m.k,0),deaths=pairs.reduce((a,m)=>a+m.d,0);
 const wr=days.map(d=>d.matches.filter(m=>m.result==='W').length/d.matches.length);
 return {days:days.length,scoreDays:sc.length,games:ms.length,wins,wr:wr.length?wr.reduce((a,b)=>a+b,0)/wr.length:0,avg:sc.length?sc.reduce((a,b)=>a+b,0)/sc.length:null,kd:deaths?k/deaths:null};
}
function interval(good,bad){
 const bucket=days=>{const groups={};for(const d of days){const score=dayScore(d);if(score==null)continue;const k=weekStart(d.day);(groups[k]=groups[k]||[]).push(score);}return Object.values(groups);};
 const a=bucket(good),b=bucket(bad);if(a.length<4||b.length<4)return null;
 let seed=271828;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
 const draw=xs=>{let sum=0,n=0;for(let i=0;i<xs.length;i++){const group=xs[Math.floor(rnd()*xs.length)];for(const v of group){sum+=v;n++;}}return sum/n;};
 const gaps=Array.from({length:600},()=>draw(a)-draw(b)).sort((x,y)=>x-y);return [gaps[15],gaps[584]];
}
function factor(days,key){
 const f=FACTORS[key],val=d=>d.a[f.i],gd=days.filter(d=>num(val(d))&&f.good(val(d))),bd=days.filter(d=>num(val(d))&&f.bad(val(d)));
 const good=agg(gd),bad=agg(bd),enough=good.scoreDays>=MIN_SIDE&&bad.scoreDays>=MIN_SIDE;
 const scoreGap=good.avg!=null&&bad.avg!=null?good.avg-bad.avg:0,wrGap=good.wr-bad.wr,ci=enough?interval(gd,bd):null;
 const stable=!!ci&&(ci[0]>0||ci[1]<0),impact=enough&&good.avg?scoreGap/good.avg*100:0;
 return {key,good,bad,enough,scoreGap,wrGap,impact,interval:ci,stable};
}
function insights(data,game,lookback,filters={}){
 const chosen=chosenContext(data,game,filters),days=joinDays(data,game,lookback,chosen),factors=Object.keys(FACTORS).map(k=>factor(days,k));
 const withUnwell=joinDays(data,game,lookback,chosen,true);
 for(const f of factors){const alt=factor(withUnwell,f.key);f.sensitivityGap=alt.scoreGap;f.sensitivityChanged=f.enough&&alt.enough&&f.scoreGap*alt.scoreGap<0;if(f.sensitivityChanged)f.stable=false;}
 // Preserve a fixed order: picking the largest of many effects exaggerates noisy results.
 const used=new Set(days.flatMap(d=>d.matches).map(m=>m.id)),excluded=data.matches.filter(m=>m.game===game&&!m.sample&&!used.has(m.id)).length;
 return {game,context:chosen,metric:LRCatalog.metricLabel({game,metricType:chosen.metricType||(game==='cs2'?'adr':'performanceScore')}),have:days.length,need:Math.max(0,MIN_DAYS-days.length),min:MIN_DAYS,overall:agg(days),factors,excluded};
}

/* ---------------- weekly goals ---------------- */
function median(arr){ const a=arr.filter(num).sort((x,y)=>x-y); return a.length?a[Math.floor((a.length-1)/2)]:null; }
function recentAns(data,idx,before,n=14){
  const out=[]; for(let i=1;i<=n;i++){ const r=data.checkins[addDays(before,-i)]; if(r&&r.a&&num(r.a[idx])) out.push(r.a[idx]); } return out;
}
function hitOn(goal,rec){
  if(goal.kind==='checkin') return !!(rec&&rec.a);
  if(!rec||!rec.a) return false;
  const v=rec.a[FACTORS[goal.kind].i]; if(!num(v)) return false;
  switch(goal.kind){
    case 'bed': return v<=goal.target;
    case 'dur': return v>=goal.target;
    case 'phone': return v<=goal.target;
    case 'move': return v>0;
    case 'caf': return v<=1;
  }
  return false;
}
function evalWeek(goal,ws,data){
  const today=dayKey();
  const days=weekDays(ws).map(d=>({day:d,future:d>today,hit:hitOn(goal,data.checkins[d])}));
  return {days,x:days.filter(d=>d.hit).length,n:goal.n};
}
// One small step from where the player is now (a 2 am sleeper gets "before 2 am", not "11 pm").
function makeGoal(kind,data){
  const today=dayKey();
  if(kind==='checkin') return {kind,n:5,target:null,keep:false,now:null};
  const idx=FACTORS[kind].i, rec=recentAns(data,idx,today), med=median(rec);
  let target=null, keep=false;
  // the goal sits on the "good" side of the same split the insight used, one notch at a time
  if(kind==='bed'){ if(med!=null&&med>=3) target=med-1; else { target=2; keep=true; } }          // after 2am -> before 2am -> before 1am
  if(kind==='dur'){ if(med!=null&&med>=3){ target=3; keep=true; } else target=Math.max(1,(med??1)+1); } // <5h -> 5h+ -> 6h+ -> 7h+
  if(kind==='phone'){ target=2; keep=med!=null&&med<=2; }                                       // >30 min -> 30 min or less
  if(kind==='move'){ keep=med!=null&&med>0; }
  if(kind==='caf'){ keep=med!=null&&med<=1; }
  const g={kind,target,keep,now:med,n:3};
  // already hitting it most days? ask for a bit more, still realistic
  const last7=[...Array(7)].map((_,i)=>data.checkins[addDays(today,-1-i)]).filter(r=>hitOn(g,r)).length;
  if(last7>=3) g.n=5;
  return g;
}
function goalText(g){
  if(g.kind==='checkin') return t('g.checkin',{n:g.n});
  if(g.kind==='bed'||g.kind==='dur'||g.kind==='phone') return t('g.'+g.kind,{n:g.n,x:'@gx.'+g.kind+'#'+g.target});
  return t('g.'+g.kind,{n:g.n});
}
function goalWhy(g){
  if(g.kind==='checkin') return t('g.checkinWhy');
  if(g.keep) return t('gw.keep');
  if(g.now==null) return '';
  const opt=raw('q.'+g.kind+'.o')[g.now]; return t('gw.step',{now:opt});
}
function evidence(f,m){
  const w=raw('F.'+f.key), r=v=>v==null?'—':Math.round(v);
  return t('w.ev',{bad:w.bad,m,sa:r(f.bad.avg),sb:r(f.good.avg),wa:Math.round(f.bad.wr*100),wb:Math.round(f.good.wr*100),na:f.bad.days,nb:f.good.days});
}
function weekly(data){
  const today=dayKey(), ws=weekStart(today), lws=addDays(ws,-7);
  const game=mainGame(data), ins=insights(data,game,LOOKBACK);
  // Observational comparisons do not automatically prescribe habits.
  const top=[];
  const proposals=[makeGoal('checkin',data),...['dur','bed','phone','move'].map(k=>makeGoal(k,data))];
  const cur=data.goals[ws]||null, last=data.goals[lws]||null;
  return {today,ws,lws,game,ins,top,proposals,cur,curEval:cur&&evalWeek(cur,ws,data),last,lastEval:last&&evalWeek(last,lws,data)};
}

/* ---------------- sample data (made-up player, clearly flagged) ---------------- */
function sampleData(data){
  let seed=20261007; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const pickW=w=>{ let r=rnd()*w.reduce((a,b)=>a+b,0); for(let i=0;i<w.length;i++){ r-=w[i]; if(r<=0) return i; } return w.length-1; };
  const today=dayKey(); const MAPS={val:['Ascent','Bind','Haven','Split','Lotus'],cs2:['Mirage','Inferno','Dust2','Nuke']};
  for(let i=27;i>=1;i--){
    const day=addDays(today,-i);
    if(data.checkins[day]&&!data.checkins[day].sample) continue;
    const bed=pickW([3,7,20,30,40]);
    const dur=Math.max(0,Math.min(4,Math.round(2.4-(bed>=4?1.1:bed>=3?.5:0)+(rnd()-.5)*2.4)));
    const phone=pickW([25,20,20,35]), move=pickW([45,25,15,10,5]);
    const a=[bed,dur,phone,move,move>0?pickW([30,40,30]):null,pickW([45,25,20,10]),rnd()<.2?[0]:[[1],[1,3],[2],[3],[1]][Math.floor(rnd()*5)],pickW([35,40,25]),Math.max(0,Math.min(4,Math.round(2+(dur-2)*.5+(rnd()-.5)*2)))];
    if(rnd()<.9) data.checkins[day]={a,secs:+(8+rnd()*6).toFixed(1),at:new Date(LR.parseKey(day).getTime()+7*3600e3).toISOString(),sample:true};
    if(rnd()<.12) continue; // rest day
    const game=rnd()<.28?'cs2':'val', n=1+Math.floor(rnd()*4);
    for(let k=0;k<n;k++){
      const acs=235+(rnd()-.5)*80-(dur<=1?30:0)-(bed>=3?12:0)-(phone===3?18:0)+(move>0?9:0)-(a[7]===2?5:0)+(a[8]-2)*5;
      const win=rnd()<Math.max(.1,Math.min(.9,.5+(acs-235)/220));
      const kk=Math.max(3,Math.round(acs/14+(rnd()-.5)*6)), dd=Math.max(5,Math.round(17-(acs-235)/25+(rnd()-.5)*5));
      data.matches.push({id:uid(),day,at:new Date(LR.parseKey(day).getTime()+(8+k)*3600e3).toISOString(),game,result:win?'W':'L',
        k:kk,d:dd,a:Math.round(3+rnd()*8),score:Math.round(game==='cs2'?acs/2.7:acs),map:MAPS[game][Math.floor(rnd()*MAPS[game].length)],rank:'',shot:null,sample:true});
    }
  }
  const lws=addDays(weekStart(today),-7);
  if(!data.goals[lws]) data.goals[lws]={kind:'bed',target:3,keep:false,now:4,n:3,sample:true,setOn:lws};
  data.sampleOn=true;
  return data;
}
function clearSample(data){
  Object.keys(data.checkins).forEach(k=>{ if(data.checkins[k].sample) delete data.checkins[k]; });
  data.matches=data.matches.filter(m=>!m.sample);
  Object.keys(data.goals).forEach(k=>{ if(data.goals[k].sample) delete data.goals[k]; });
  delete data.sampleOn; return data;
}

window.LRStats={validMatch,comparable,chosenContext,agg,MIN_DAYS,FACTORS,metric,mainGame,joinDays,insights,weekly,makeGoal,goalText,goalWhy,evidence,evalWeek,hitOn,sampleData,clearSample};
})();
