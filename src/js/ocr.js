/* Lazy, same-origin screenshot OCR. Suggestions require explicit review. 5-field parse. */
(function(){
'use strict';
let scriptPromise;
const VENDOR='js/vendor/';

function load(){
  if(window.Tesseract) return Promise.resolve();
  if(!scriptPromise){
    scriptPromise=new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src=VENDOR+'tesseract.min.js';
      s.onload=res;
      s.onerror=()=>{scriptPromise=null;s.remove();rej(new Error(LR.raw('ocr.fail')));};
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

function detectMetric(text){
  return /Performance\s*Score|戰鬥表現評分|戰鬥表現分|战斗表现评分|战斗表现分|表现分数|表現分數/i.test(text)?'performanceScore'
    :/\bACS\b/i.test(text)?'acs'
    :/\bADR\b/i.test(text)?'adr'
    :null;
}

function parseResult(text){
  if(/VICTORY|胜利|勝利|获胜|獲勝|\bWIN\b/i.test(text)) return 'W';
  if(/DEFEAT|战败|戰敗|失败|失敗|\bLOSS\b/i.test(text)) return 'L';
  if(/DRAW|平局|平手|TIE/i.test(text)) return 'D';
  return null;
}

function parseMap(text,game){
  if(!window.LRCatalog) return null;
  const pool=LRCatalog.maps[game]||LRCatalog.maps.val||[];
  const ranked=pool.slice().sort((a,b)=>b.length-a.length);
  for(const id of ranked){
    const esc=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(new RegExp('\\b'+esc+'\\b','i').test(text)) return id;
  }
  // Localized SC/TC/EN labels embedded in OCR text (substring)
  for(const id of ranked){
    const aliases=(LRCatalog.mapAliases?LRCatalog.mapAliases(id):[id,LRCatalog.mapName(id)]);
    for(const label of aliases){
      if(label&&String(label).length>=2&&text.includes(label)) return id;
    }
  }
  // Exact line / token via catalog resolver
  for(const part of text.split(/[\n\r|,，/]/).map(x=>x.trim()).filter(Boolean)){
    const hit=LRCatalog.resolveMap(part);
    if(hit&&pool.includes(hit)) return hit;
  }
  return null;
}

function parseAgent(text){
  if(!window.LRCatalog) return null;
  const list=LRCatalog.agents.slice().sort((a,b)=>b.length-a.length);
  for(const id of list){
    const esc=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(new RegExp('\\b'+esc+'\\b','i').test(text)) return id;
  }
  for(const id of list){
    const aliases=(LRCatalog.agentAliases?LRCatalog.agentAliases(id):[id,LRCatalog.agentName(id)]);
    for(const label of aliases){
      if(label&&String(label).length>=2&&text.includes(label)) return id;
    }
  }
  for(const part of text.split(/[\n\r|,，]/).map(x=>x.trim()).filter(Boolean)){
    const hit=LRCatalog.resolveAgent(part);
    if(hit&&LRCatalog.agents.includes(hit)) return hit;
  }
  return null;
}

function suggestions(text,game){
  const out={};
  const kda=text.match(/\bK\s*[/|]\s*D\s*[/|]\s*A\s*[:：]?\s*(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})\b/i);
  if(kda)[out.k,out.d,out.a]=kda.slice(1).map(Number);
  // Compact patterns like 12/8/3 near KDA header
  if(out.k==null){
    const compact=text.match(/(?:K\s*[/|]\s*D\s*[/|]\s*A|KDA|击杀|擊殺)[^\d]{0,12}(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/i);
    if(compact)[out.k,out.d,out.a]=compact.slice(1).map(Number);
  }
  const fields={
    k:/(?:\bKills?\b|击杀|擊殺)\s*[:：]\s*(\d{1,2})/i,
    d:/(?:\bDeaths?\b|死亡)\s*[:：]\s*(\d{1,2})/i,
    a:/(?:\bAssists?\b|助攻)\s*[:：]\s*(\d{1,2})/i,
    score:/(?:Performance\s*Score|表現分數|戰鬥表現評分|戰鬥表現分|战斗表现评分|战斗表现分|表现分数|\bACS\b|\bADR\b)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i,
    hs:/(?:Headshot\s*%?|爆头率|爆頭率|\bHS%)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i
  };
  const metric=detectMetric(text);
  if(metric==='performanceScore') fields.score=/(?:Performance\s*Score|表現分數|戰鬥表現評分|戰鬥表現分|战斗表现评分|战斗表现分|表现分数)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i;
  else if(metric==='acs') fields.score=/\bACS\b\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i;
  else if(metric==='adr') fields.score=/\bADR\b\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i;
  for(const [k,re] of Object.entries(fields)){
    if(out[k]!=null) continue;
    const m=text.match(re);
    if(m) out[k]=Number(m[1]);
  }
  const result=parseResult(text);
  if(result) out.result=result;
  const map=parseMap(text,game||'val');
  if(map) out.map=map;
  const agent=parseAgent(text);
  if(agent) out.agent=agent;
  return out;
}

function filledKeyCount(values){
  let n=0;
  if(values.result) n++;
  if(values.k!=null&&values.d!=null&&values.a!=null) n++;
  if(values.score!=null) n++;
  if(values.map) n++;
  if(values.agent) n++;
  return n;
}

let availableCache=null;
function available(){
  if(availableCache!=null) return availableCache;
  availableCache=fetch(new URL(VENDOR+'tesseract.min.js', location.href), {method:'HEAD', cache:'no-store'})
    .then(r=>{
      if(!r.ok) return false;
      const ct=(r.headers.get('content-type')||'').toLowerCase();
      if(ct.includes('html')) return false;
      return ct.includes('javascript')||ct.includes('ecmascript')||ct.includes('octet-stream')||ct===''||ct.includes('text/plain');
    })
    .catch(()=>false);
  return availableCache;
}

function open(form){
  const {t}=LR;
  available().then(ok=>{ if(!ok){ LR.toast(t('ocr.unavailable')); return; } _open(form); });
}

function _open(form){
  const {t,esc}=LR;
  const game=form.dataset.game||'val';
  const w=document.createElement('div');
  w.className='modal on';
  let alive=true,worker=null,image=null,rect=null,origin=null,busy=false,detectedMetric=null;
  const c=document.createElement('canvas'),g=c.getContext('2d');
  c.className='ocr-canvas';

  const mapOpts=(LRCatalog.maps[game]||[]).map(id=>`<option value="${esc(id)}">${esc(LRCatalog.mapName(id))} · ${esc(id)}</option>`).join('');
  const agentOpts=game==='val'?LRCatalog.agents.map(id=>`<option value="${esc(id)}">${esc(LRCatalog.agentName(id))} · ${esc(id)}</option>`).join(''):'';
  const scoreLabel=LRCatalog.metricLabel({game,metricType:form.elements.metricType?.value||(game==='cs2'?'adr':'performanceScore')});

  w.innerHTML=`<div class="modal-card ocr-dialog" role="dialog" aria-modal="true" aria-label="${t('ocr.h')}">
    <h2>${t('ocr.h')}</h2>
    <p class="muted sm">${t('ocr.note')}</p>
    <div class="row gap"><button class="btn ghost" data-ocr-pick>${t('ocr.choose')}</button><button class="btn ghost" data-ocr-read disabled>${t('ocr.read')}</button></div>
    <div data-ocr-image></div>
    <p class="muted xs" data-ocr-status aria-live="polite"></p>
    <label class="lbl">${t('ocr.text')}<textarea data-ocr-text rows="4" readonly></textarea></label>
    <div class="fgrid">
      <label class="lbl">${t('m.res')}<select data-ocr-value="result"><option value="">—</option><option value="W">${t('m.W')}</option><option value="L">${t('m.L')}</option><option value="D">${t('m.D')}</option></select><span class="muted xs" data-ocr-hint="result" hidden>${t('ocr.verify')}</span></label>
      <label class="lbl">K<input data-ocr-value="k" type="number" min="0" max="99" step="1"><span class="muted xs" data-ocr-hint="k" hidden>${t('ocr.verify')}</span></label>
      <label class="lbl">D<input data-ocr-value="d" type="number" min="0" max="99" step="1"><span class="muted xs" data-ocr-hint="d" hidden>${t('ocr.verify')}</span></label>
      <label class="lbl">A<input data-ocr-value="a" type="number" min="0" max="99" step="1"><span class="muted xs" data-ocr-hint="a" hidden>${t('ocr.verify')}</span></label>
      <label class="lbl">${esc(scoreLabel)}<input data-ocr-value="score" type="number" min="0" step=".1" max="${game==='val'&&form.elements.metricType?.value==='performanceScore'?500:999}"><span class="muted xs" data-ocr-hint="score" hidden>${t('ocr.verify')}</span></label>
      <label class="lbl">${t('m.map')}<select data-ocr-value="map"><option value="">—</option>${mapOpts}</select><span class="muted xs" data-ocr-hint="map" hidden>${t('ocr.verify')}</span></label>
      ${game==='val'?`<label class="lbl">${t('m.agent')}<select data-ocr-value="agent"><option value="">—</option>${agentOpts}</select><span class="muted xs" data-ocr-hint="agent" hidden>${t('ocr.verify')}</span></label>`:''}
      <label class="lbl">${t('m.hs')}<input data-ocr-value="hs" type="number" min="0" max="100" step=".1"><span class="muted xs" data-ocr-hint="hs" hidden>${t('ocr.verify')}</span></label>
    </div>
    <div class="row gap"><button class="btn primary" data-ocr-apply>${t('ocr.apply')}</button><button class="btn ghost" data-ocr-close>${t('cancel')}</button></div>
  </div>`;

  document.body.appendChild(w);
  w.querySelector('[data-ocr-image]').appendChild(c);
  const status=w.querySelector('[data-ocr-status]'),read=w.querySelector('[data-ocr-read]');
  const close=()=>{alive=false;if(worker)worker.terminate();w.remove();removeEventListener('keydown',key);};
  const key=e=>{if(e.key==='Escape')close();};
  addEventListener('keydown',key);
  w.querySelector('[data-ocr-close]').onclick=close;

  function paint(){
    if(!image)return;
    g.clearRect(0,0,c.width,c.height);
    g.drawImage(image,0,0,c.width,c.height);
    if(rect){g.strokeStyle='#ff6a3d';g.lineWidth=Math.max(2,c.width/400);g.strokeRect(rect.x,rect.y,rect.w,rect.h);}
  }
  const point=e=>{
    const b=c.getBoundingClientRect();
    return {x:Math.max(0,Math.min(c.width,(e.clientX-b.left)*c.width/b.width)),y:Math.max(0,Math.min(c.height,(e.clientY-b.top)*c.height/b.height))};
  };
  c.onpointerdown=e=>{if(!image||busy)return;origin=point(e);c.setPointerCapture(e.pointerId);};
  c.onpointermove=e=>{if(!origin||busy)return;const p=point(e);rect={x:Math.min(origin.x,p.x),y:Math.min(origin.y,p.y),w:Math.abs(p.x-origin.x),h:Math.abs(p.y-origin.y)};paint();};
  c.onpointerup=()=>{origin=null;if(rect&&(rect.w<5||rect.h<5))rect=null;paint();};

  function buildCrop(){
    const r=rect||{x:0,y:0,w:c.width,h:c.height};
    const sx=r.x*image.naturalWidth/c.width,sy=r.y*image.naturalHeight/c.height;
    const sw=r.w*image.naturalWidth/c.width,sh=r.h*image.naturalHeight/c.height;
    let cw=Math.max(1,Math.round(sw)),ch=Math.max(1,Math.round(sh));
    const maxSide=Math.max(cw,ch);
    if(maxSide>1600){const s=1600/maxSide;cw=Math.max(1,Math.round(cw*s));ch=Math.max(1,Math.round(ch*s));}
    const crop=document.createElement('canvas');crop.width=cw;crop.height=ch;
    crop.getContext('2d').drawImage(image,sx,sy,sw,sh,0,0,cw,ch);
    return crop;
  }

  function setHints(values){
    w.querySelectorAll('[data-ocr-hint]').forEach(el=>{el.hidden=true;});
    for(const k of Object.keys(values)){
      const hint=w.querySelector(`[data-ocr-hint="${k}"]`);
      if(hint) hint.hidden=false;
    }
  }

  function fillValues(values){
    for(const [k,v] of Object.entries(values)){
      const el=w.querySelector(`[data-ocr-value="${k}"]`);
      if(!el) continue;
      el.value=v;
      // Mark map/agent for review when present (often less stable)
      if(k==='map'||k==='agent'){
        const hint=w.querySelector(`[data-ocr-hint="${k}"]`);
        if(hint) hint.hidden=false;
      }
    }
    setHints(values);
  }

  async function runOcr(){
    if(!image||busy)return;
    busy=true;read.disabled=true;status.textContent=t('ocr.busy');
    try{
      await load();if(!alive)return;
      const base=new URL(VENDOR,location.href).href;
      // Force LSTM-only core file so slim vendor (no simd matrix) always resolves
      const lang=LR.lang==='sc'?'eng+chi_sim':LR.lang==='tc'?'eng+chi_tra':'eng';
      worker=await Tesseract.createWorker(lang,1,{
        workerPath:base+'worker.min.js',
        corePath:base, // full vendor: allow simd/lstm auto-pick
        langPath:base,
        workerBlobURL:false
      });
      if(!alive){worker.terminate();return;}
      const crop=buildCrop();
      const result=await worker.recognize(crop);if(!alive)return;
      const data=result.data;
      w.querySelector('[data-ocr-text]').value=data.text;
      const values=suggestions(data.text,game);
      detectedMetric=detectMetric(data.text);
      if(game==='val'&&['acs','performanceScore'].includes(detectedMetric)){
        const score=w.querySelector('[data-ocr-value=score]');
        if(score){
          score.max=detectedMetric==='acs'?999:500;
          const lbl=score.closest('label');
          if(lbl){
            const textNode=[...lbl.childNodes].find(n=>n.nodeType===3);
            // leave label; update via first text — safer to set data attribute
          }
        }
      }
      w.querySelectorAll('[data-ocr-value]').forEach(x=>{if(x.tagName==='SELECT')x.value='';else x.value='';});
      w.querySelectorAll('[data-ocr-hint]').forEach(el=>{el.hidden=true;});
      fillValues(values);
      const keys=filledKeyCount(values);
      if(keys===0) status.textContent=t('ocr.partial');
      else if(keys<4) status.textContent=t('ocr.partial');
      else status.textContent=t('ocr.confidence',{n:Math.round(data.confidence)});
      await worker.terminate();worker=null;
    }catch(e){
      if(alive) status.textContent=t('ocr.partial');
      if(worker){worker.terminate();worker=null;}
    }finally{
      busy=false;if(alive)read.disabled=false;
    }
  }

  w.querySelector('[data-ocr-pick]').onclick=()=>{
    const inp=document.createElement('input');inp.type='file';inp.accept='image/png,image/jpeg,image/webp';
    inp.onchange=async()=>{
      const f=inp.files[0];if(!f)return;
      if(f.size>15*1024*1024){status.textContent=t('ocr.partial');return;}
      try{
        const u=URL.createObjectURL(f),im=new Image();
        await new Promise((res,rej)=>{im.onload=res;im.onerror=rej;im.src=u;});
        URL.revokeObjectURL(u);if(!alive)return;
        image=im;detectedMetric=null;
        const scale=Math.min(1,1280/Math.max(im.naturalWidth,im.naturalHeight));
        c.width=Math.max(1,Math.round(im.naturalWidth*scale));
        c.height=Math.max(1,Math.round(im.naturalHeight*scale));
        rect=null;paint();
        read.disabled=false;
        w.querySelector('[data-ocr-text]').value='';
        w.querySelectorAll('[data-ocr-value]').forEach(x=>{if(x.tagName==='SELECT')x.value='';else x.value='';});
        w.querySelectorAll('[data-ocr-hint]').forEach(el=>{el.hidden=true;});
        status.textContent=t('ocr.busy');
        runOcr();
      }catch(e){status.textContent=t('ocr.partial');}
    };
    inp.click();
  };
  read.onclick=()=>runOcr();

  w.querySelector('[data-ocr-apply]').onclick=()=>{
    const inputs=[...w.querySelectorAll('[data-ocr-value]')];
    for(const x of inputs){
      if(x.value===''||x.tagName==='SELECT') continue;
      if(!x.checkValidity()){x.reportValidity();return;}
    }
    if(!form.isConnected){close();return;}

    if(form.elements.metricType&&['acs','performanceScore'].includes(detectedMetric)){
      const scoreEl=w.querySelector('[data-ocr-value=score]');
      if(scoreEl&&scoreEl.value!==''){
        form.elements.metricType.value=detectedMetric;
        form.elements.metricType.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }

    let any=false;
    let keyFilled=0;
    const got={};

    for(const x of inputs){
      if(x.value==='') continue;
      const key=x.dataset.ocrValue;
      got[key]=x.value;
      if(key==='result'){
        const btn=form.querySelector(`[data-res="${x.value}"]`);
        if(btn) btn.click();
        any=true; keyFilled++;
        continue;
      }
      if(key==='map'||key==='agent'){
        if(form.elements[key]){
          form.elements[key].value=x.value;
          form.elements[key].dispatchEvent(new Event('change',{bubbles:true}));
          any=true;
          keyFilled++;
        }
        continue;
      }
      if(form.elements[key]){
        form.elements[key].value=x.value;
        any=true;
      }
    }
    if(got.k!=null&&got.d!=null&&got.a!=null) keyFilled++;
    if(got.score!=null&&got.score!=='') keyFilled++;

    if(any&&form.elements.source) form.elements.source.value='screenshot';

    // Incomplete → toast product copy, still leave user on form with partial prefill
    if(keyFilled<4){
      try{ LR.toast(t('ocr.partial')); }catch(_){}
    }
    close();
  };
}

window.LROCR={open,suggestions,detectMetric,available,parseResult,parseMap,parseAgent,filledKeyCount};
})();
