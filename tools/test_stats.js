// Quick logic checks for stats.js (node tools/test_stats.js)
const fs=require('fs'), vm=require('vm'), path=require('path');
const S=p=>fs.readFileSync(path.join(__dirname,'../src/js',p),'utf8');
const store={};
const ctx={console,navigator:{language:'en-US'},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},
  document:{documentElement:{dataset:{},classList:{add(){},remove(){},toggle(){}}},querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},window:{},URLSearchParams,setTimeout,Date,Math,JSON};
ctx.window=ctx; vm.createContext(ctx);
vm.runInContext(S('i18n.js').replace('const I18N','var I18N'),ctx);
vm.runInContext(S('core.js'),ctx); vm.runInContext(S('stats.js'),ctx);
const {LR,LRStats:St}=ctx; let fails=0;
const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
const today=LR.dayKey();
const mk=(fn,days=20)=>{ const d={settings:{},checkins:{},matches:[],goals:{},lineups:{}}; for(let i=1;i<=days;i++){ const k=LR.addDays(today,-i); d.checkins[k]={a:fn(i)}; } return d; };
// 2 am sleeper -> "before 2 am", not "11 pm"
let d=mk(i=>[4,1,3,0,null,0,[1],1,2]);
let g=St.makeGoal('bed',d); ok(g.target===3&&!g.keep,'2am sleeper gets target bucket 3 (before 2 am)'); ok(/2 am/.test(St.goalText(g)),'text: '+St.goalText(g));
g=St.makeGoal('dur',d); ok(g.target===2,'5-6h sleeper -> 6h+ ('+St.goalText(g)+')');
g=St.makeGoal('phone',d); ok(g.target===2&&!g.keep,'30min+ scroller -> 30 min or less ('+St.goalText(g)+')');
d=mk(i=>[1,3,0,2,1,0,[1],0,3]);
g=St.makeGoal('bed',d); ok(g.keep&&g.target===2,'early sleeper -> keep before 1 am');
// insights: not enough data
d=mk(i=>[4,1,3,0,null,0,[1],1,2],5);
let ins=St.insights(d,'val'); ok(ins.need===8,'no games -> need 8 days (got '+ins.need+')');
// sample data -> enough, weekly gives 1-2 habits + one goal
d={settings:{},checkins:{},matches:[],goals:{},lineups:{}}; St.sampleData(d);
ins=St.insights(d,'val'); ok(ins.need===0,'sample data has enough days ('+ins.have+')');
const w=St.weekly(d); ok(w.top.length>=1&&w.top.length<=2,'weekly top habits: '+w.top.map(f=>f.key+':'+f.impact.toFixed(1)).join(', '));
ok(w.proposals.length>=1,'goal: '+St.goalText(w.proposals[0]));
ok(w.lastEval&&w.lastEval.n===3,'last week evaluated: '+w.lastEval.x+'/'+w.lastEval.n);
St.clearSample(d); ok(!d.matches.length&&!Object.keys(d.checkins).length&&!Object.keys(d.goals).length,'clear sample removes everything');
// starter goal when no data
d={settings:{},checkins:{},matches:[],goals:{},lineups:{}};
ok(St.weekly(d).proposals[0].kind==='checkin','no data -> starter goal "check in 5 days"');
process.exit(fails?1:0);
