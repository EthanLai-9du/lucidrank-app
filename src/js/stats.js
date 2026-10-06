/* LucidRank desktop: insights, rule-based weekly advice, and sample data. No AI, no network. */
(function(){
'use strict';
const {t,raw,dayKey,addDays,weekStart,weekDays,uid}=LR;

const MIN_DAYS=8, MIN_SIDE=3, IMPACT_MIN=4, LOOKBACK=42;
// answer slots: 0 bed · 1 dur · 2 phone · 3 move · 4 gap · 5 meal · 6 pre · 7 caf · 8 mood
const FACTORS={
  dur:  {i:1, bad:v=>v<=1, good:v=>v>=3},     // <6h vs >=7h (6–7h left out)
  bed:  {i:0, bad:v=>v>=3, good:v=>v<=2},     // after 1 am vs before
  phone:{i:2, bad:v=>v===3, good:v=>v<=2},    // >30 min vs not
  move: {i:3, bad:v=>v===0, good:v=>v>0},     // none vs any
  caf:  {i:7, bad:v=>v===2, good:v=>v<=1},    // 2+ vs 0–1
};
const metric=g=>g==='cs2'?'ADR':'ACS';
const num=v=>typeof v==='number'&&isFinite(v);

function mainGame(data){
  const n={val:0,cs2:0}; data.matches.forEach(m=>{ if(n[m.game]!==undefined) n[m.game]++; });
  return n.cs2>n.val?'cs2':'val';
}
// days that have both a check-in and >= 1 game of `game`
function joinDays(data,game,lookback){
  const today=dayKey(), from=lookback?addDays(today,-lookback):'0000';
  const by={};
  data.matches.forEach(m=>{ if(m.game!==game||m.day<from) return; (by[m.day]=by[m.day]||[]).push(m); });
  return Object.keys(by).filter(d=>data.checkins[d]&&data.checkins[d].a).sort().map(d=>({day:d,a:data.checkins[d].a,matches:by[d]}));
}
function agg(days){
  const ms=days.flatMap(d=>d.matches), sc=ms.map(m=>m.score).filter(num);
  const wins=ms.filter(m=>m.result==='W').length;
  return {days:days.length,games:ms.length,wins,wr:ms.length?wins/ms.length:0,avg:sc.length?sc.reduce((a,b)=>a+b,0)/sc.length:null};
}
function factor(days,key){
  const f=FACTORS[key];
  const val=d=>d.a[f.i];
  const good=agg(days.filter(d=>num(val(d))&&f.good(val(d)))), bad=agg(days.filter(d=>num(val(d))&&f.bad(val(d))));
  const enough=good.days>=MIN_SIDE&&bad.days>=MIN_SIDE;
  const scoreGap=(good.avg!=null&&bad.avg!=null)?good.avg-bad.avg:0;
  const wrGap=good.wr-bad.wr;
  // impact: % score gap + half the win-rate gap in points (both "bad side is worse" when positive)
  const impact=enough?(good.avg?scoreGap/good.avg*100:0)+wrGap*100/2:0;
  return {key,good,bad,enough,scoreGap,wrGap,impact};
}
function insights(data,game,lookback){
  const days=joinDays(data,game,lookback);
  const factors=Object.keys(FACTORS).map(k=>factor(days,k));
  factors.sort((a,b)=>(b.enough-a.enough)||(b.impact-a.impact));
  return {game,metric:metric(game),have:days.length,need:Math.max(0,MIN_DAYS-days.length),min:MIN_DAYS,overall:agg(days),factors};
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
  const top=ins.need?[]:ins.factors.filter(f=>f.enough&&f.impact>=IMPACT_MIN).slice(0,2);
  const proposals=top.length?top.map(f=>Object.assign(makeGoal(f.key,data),{why:f.key})):[makeGoal('checkin',data)];
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

window.LRStats={MIN_DAYS,FACTORS,metric,mainGame,joinDays,insights,weekly,makeGoal,goalText,goalWhy,evidence,evalWeek,hitOn,sampleData,clearSample};
})();
