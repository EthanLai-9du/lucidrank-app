/* Visual shell and reversible UI interactions. No health scoring or data writes. */
(()=>{'use strict';
const copy={
 sc:{quick:'快捷操作',find:'搜索页面或操作',empty:'没有找到匹配的操作',close:'关闭',today:'今天',checkin:'记录状态',checkinSub:'睡眠、身体与执行情况',log:'记一场战绩',logSub:'记录这场真实表现',lineups:'练一个点位',lineupsSub:'查看教学与练习步骤',training:'开始训练',matches:'查看战绩',insights:'查看洞察',week:'本周计划',settings:'设置',account:'账号与同步',ready:'从这里开始',done:'今日已记录',recorded:'今日 {n} 场',hero:'先清醒。\n再上场。',next:'下一步',back:'上一步',body:'身体状态',diet:'饮食记录',plan:'计划执行',step:'第 {n} 步，共 3 步',live:'本场速览',delta:'击杀差',assist:'助攻',shortcuts:'输入搜索 · ↑↓ 选择 · Enter 打开',review:'查看今日状态'},
 tc:{quick:'快捷操作',find:'搜尋頁面或操作',empty:'沒有找到符合的操作',close:'關閉',today:'今天',checkin:'記錄狀態',checkinSub:'睡眠、身體與執行情況',log:'記一場戰績',logSub:'記錄這場真實表現',lineups:'練一個點位',lineupsSub:'查看教學與練習步驟',training:'開始訓練',matches:'查看戰績',insights:'查看洞察',week:'本週計劃',settings:'設定',account:'帳號與同步',ready:'從這裡開始',done:'今日已記錄',recorded:'今日 {n} 場',hero:'先清醒。\n再上場。',next:'下一步',back:'上一步',body:'身體狀態',diet:'飲食記錄',plan:'計劃執行',step:'第 {n} 步，共 3 步',live:'本場速覽',delta:'擊殺差',assist:'助攻',shortcuts:'輸入搜尋 · ↑↓ 選擇 · Enter 開啟',review:'查看今日狀態'},
 en:{quick:'Quick actions',find:'Find a page or action',empty:'No matching actions',close:'Close',today:'Today',checkin:'Check in',checkinSub:'Sleep, health & follow-through',log:'Log a match',logSub:'Capture this performance',lineups:'Practice a lineup',lineupsSub:'Tutorials, then repetition',training:'Start practice',matches:'Match history',insights:'Your insights',week:'Weekly plan',settings:'Settings',account:'Account & sync',ready:'YOUR NEXT MOVE',done:'CHECKED IN TODAY',recorded:'{n} MATCHES TODAY',hero:'STAY LUCID.\nPLAY SHARP.',next:'Next',back:'Back',body:'Body & sleep',diet:'Food & meals',plan:'Follow-through',step:'Step {n} of 3',live:'MATCH SNAPSHOT',delta:'Kill delta',assist:'Assists',shortcuts:'Type to search · ↑↓ to select · Enter to open',review:'Review today’s check-in'}
};
const tr=(k)=> (copy[LR.lang]||copy.sc)[k];
const names={today:'DAILY / 01',matches:'MATCH LOG / 02',insights:'INSIGHTS / 03',week:'WEEKLY / 04',library:'LIBRARY / 06',training:'PRACTICE / 07',settings:'SYSTEM / 08'};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const content=document.querySelector('#content');if(!content){const host=document.querySelector('#ciHost');if(host){const update=()=>host.querySelectorAll('.hc-form').forEach(checkinSteps);new MutationObserver(update).observe(host,{childList:true,subtree:true});update();}return;}
function action(id){
 if(id==='checkin'||id==='lineups'){LRMain.showInline(id==='checkin'?'checkin':'lineups');return;}
 if(id==='account'){LRAccount.open();return;}
 LRMain.setView(id==='log'?'today':id);
 if(id==='log'){const f=document.querySelector('#logForm');f?.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});f?.querySelector('[data-res]')?.focus({preventScroll:true});}
}
function hero(){
 const view=document.querySelector('#v-today'),image=view.querySelector(':scope > .routine-banner');if(!image)return;
 const d=LR.store.data,day=LR.dayKey(),rec=d.checkins[day],n=d.matches.filter(m=>m.day===day&&!m.sample).length;
 const h=document.createElement('section');h.className='daily-launch';h.setAttribute('aria-label',tr('quick'));
 h.innerHTML=`<div class="launch-art"><span class="launch-edition" aria-hidden="true">LUCIDRANK / DAILY ROUTINE</span><strong>${LR.esc(tr('hero')).replace('\n','<br>')}</strong><span class="launch-status">${rec&&!rec.sample?'✓ '+tr('done'):tr('ready')}</span><span class="launch-cross" aria-hidden="true">✳</span></div><div class="launch-actions">${['checkin','log','lineups'].map((id,i)=>`<button type="button" data-quick="${id}"><span class="launch-number" aria-hidden="true">0${i+1}</span><span><b>${LR.esc(id==='checkin'&&rec&&!rec.sample?tr('review'):tr(id))}</b><small>${LR.esc(id==='log'&&n?tr('recorded').replace('{n}',n):tr(id+'Sub'))}</small></span><span class="launch-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;image.replaceWith(h);
}
function snapshot(f){
 if(f.querySelector('.live-snapshot'))return;
 const box=document.createElement('div');box.className='live-snapshot';box.innerHTML=`<span class="snapshot-label">${tr('live')}</span><div><span>K/D</span><b data-live-kd>—</b></div><div><span>${tr('delta')}</span><b data-live-delta>—</b></div><div><span>${tr('assist')}</span><b data-live-a>—</b></div>`;
 f.querySelector('.fgrid').after(box);
 function update(){const num=k=>{const e=f.elements[k];return e.value!==''&&e.validity.valid?Number(e.value):null;},k=num('k'),d=num('d'),a=num('a');const values={'kd':k==null||d==null?'—':d?(k/d).toFixed(2):k?'∞':'—','delta':k==null||d==null?'—':(k-d>0?'+':'')+(k-d),'a':a??'—'};for(const [key,value]of Object.entries(values)){const e=box.querySelector('[data-live-'+key+']');if(e.textContent!==String(value))e.textContent=value;}box.dataset.result=f.querySelector('[data-res][aria-pressed=true]')?.dataset.res||'';}
 f.addEventListener('input',update);f.addEventListener('change',update);f.addEventListener('click',update);update();
}
function checkinSteps(f){
 if(f.dataset.stepped)return;f.dataset.stepped='true';const wrap=f.closest('.hc-wrap');if(!wrap.querySelector('.hc-dismiss')){const exit=document.createElement('button');exit.type='button';exit.className='hc-dismiss';exit.setAttribute('aria-label',tr('close'));exit.textContent='×';exit.onclick=()=>wrap.querySelector('.hc-close')?.click();wrap.prepend(exit);}
 const children=[...f.children],diet=f.querySelector('.hc-diet'),plan=diet?.nextElementSibling;if(!diet||!plan)return;
 const panels=[0,1,2].map(i=>{const p=document.createElement('section');p.className='checkin-step';p.id='health-step-'+i;return p;});let zone=0;
 for(const el of children){if(el===diet)zone=1;if(el===plan)zone=2;if(el.matches('.hc-error,button'))continue;panels[zone].append(el);}
 diet.open=true;
 const nav=document.createElement('nav');nav.className='checkin-steps';nav.setAttribute('aria-label',tr('checkin'));
 nav.innerHTML=['body','diet','plan'].map((k,i)=>`<button type="button" data-step="${i}" aria-controls="health-step-${i}"><span aria-hidden="true">0${i+1}</span>${tr(k)}</button>`).join('');
 const foot=document.createElement('div');foot.className='checkin-actions';
 const prev=document.createElement('button');prev.type='button';prev.className='btn ghost';prev.textContent=tr('back');
 const next=document.createElement('button');next.type='button';next.className='btn primary';next.textContent=tr('next')+' →';
 const indicator=document.createElement('p');indicator.className='checkin-position';indicator.setAttribute('aria-live','polite');
 const save=f.querySelector('[type=submit]'),close=f.querySelector('.hc-close'),error=f.querySelector('.hc-error');
 foot.append(prev,next,save,close);f.prepend(nav,indicator,...panels);f.append(error,foot);let current=0;
 function show(i,focus=false){current=i;panels.forEach((p,j)=>p.hidden=j!==i);nav.querySelectorAll('button').forEach((b,j)=>{if(j===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});prev.hidden=i===0;next.hidden=i===2;save.hidden=i!==2;indicator.textContent=tr('step').replace('{n}',i+1);if(focus){const target=panels[i].querySelector('input,select,summary,button.chip');target?.focus({preventScroll:true});nav.scrollIntoView?.({block:'start',behavior:reduced()?'instant':'smooth'});}}
 const validate=()=>[...panels[current].querySelectorAll('input,select')].every(el=>el.reportValidity());
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b&&(Number(b.dataset.step)<=current||validate()))show(Number(b.dataset.step),true);});
 prev.onclick=()=>show(current-1,true);next.onclick=()=>{if(validate())show(current+1,true);};
 f.addEventListener('invalid',e=>{const i=panels.findIndex(p=>p.contains(e.target));if(i>=0)show(i);},true);
 f.addEventListener('submit',e=>{if(current<2){e.preventDefault();e.stopImmediatePropagation();if(validate())show(current+1,true);}},true);show(0);
}
let queued=false;
function decorate(){
 queued=false;for(const [id,name]of Object.entries(names)){const h=document.querySelector('#v-'+id+' .vh');if(h&&!h.querySelector('.section-stamp')){const stamp=document.createElement('span');stamp.className='section-stamp';stamp.setAttribute('aria-hidden','true');stamp.textContent=name;h.append(stamp);}}
 hero();const requested=new URLSearchParams(location.search).get('action');if(requested&&['checkin','log','lineups'].includes(requested)&&document.querySelector('#logForm')&&!document.documentElement.dataset.actionOpened){document.documentElement.dataset.actionOpened='true';setTimeout(()=>action(requested),0);}const f=document.querySelector('#logForm');if(f)snapshot(f);document.querySelectorAll('.hc-form').forEach(checkinSteps);
 for(const card of document.querySelectorAll('[data-go]')){card.setAttribute('role','button');card.tabIndex=0;}
 for(const b of document.querySelectorAll('#nav [data-view]')){if(b.classList.contains('on'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 const entry=document.querySelector('#developer-open');if(entry)entry.textContent=LR.lang==='en'?'Developer studio':LR.lang==='tc'?'開發者工作台':'开发者工作台';
}
const launcher=document.createElement('button');launcher.className='quick-trigger';launcher.type='button';
function label(){launcher.innerHTML=`<span aria-hidden="true">⌕</span> ${tr('quick')} <kbd>⌘ / Ctrl K</kbd>`;}
label();document.querySelector('.app-toolbar').insertBefore(launcher,document.querySelector('#account-open'));
function openQuick(){
 if(document.querySelector('dialog[open],.modal.on')||document.querySelector('#v-inline.on'))return;
 const d=document.createElement('dialog');d.className='quick-dialog';d.setAttribute('aria-labelledby','quick-title');
 d.innerHTML=`<div class="quick-heading"><h2 id="quick-title">${tr('quick')}</h2><button type="button" class="quick-close" aria-label="${tr('close')}">×</button></div><input type="search" placeholder="${tr('find')}" aria-label="${tr('find')}" autocomplete="off"><div class="quick-list"></div><p class="quick-help">${tr('shortcuts')}</p>`;
 document.body.append(d);const ids=['today','checkin','log','lineups','training','matches','insights','week','settings','account'],input=d.querySelector('input'),list=d.querySelector('.quick-list');let selected=0;
 function render(){const q=input.value.trim().toLowerCase();list.innerHTML=ids.filter(id=>(tr(id)+' '+id).toLowerCase().includes(q)).map(id=>`<button type="button" data-action="${id}"><span>${tr(id)}</span><span aria-hidden="true">↗</span></button>`).join('')||`<p class="quick-empty">${tr('empty')}</p>`;selected=0;highlight();}
 function highlight(){[...list.querySelectorAll('button')].forEach((b,i)=>b.classList.toggle('selected',i===selected));}
 function close(){d.close();}
 let routed=false;d.addEventListener('close',()=>{d.remove();if(!routed)launcher.focus();},{once:true});d.querySelector('.quick-close').onclick=close;d.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){const id=b.dataset.action;routed=true;close();action(id);}});
 input.oninput=render;d.addEventListener('keydown',e=>{if(e.target!==input)return;const buttons=[...list.querySelectorAll('button')];if(['ArrowDown','ArrowUp'].includes(e.key)&&buttons.length){e.preventDefault();selected=(selected+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;highlight();buttons[selected].scrollIntoView?.({block:'nearest'});}if(e.key==='Enter'&&buttons.length){e.preventDefault();buttons[selected].click();}});
 render();d.showModal();input.focus();
}
launcher.onclick=openQuick;
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='k'&&(e.metaKey||e.ctrlKey)){e.preventDefault();openQuick();}if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-go]')){e.preventDefault();e.target.click();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-quick]');if(b)action(b.dataset.quick);});
LR.onLang(()=>{label();decorate();});
new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(decorate);}}).observe(content,{childList:true,subtree:true});decorate();
})();
