/* Lazy, same-origin screenshot OCR. Slim vendor: LSTM core only, loaded on demand. */
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

/** Tesseract often inserts spaces between CJK glyphs ("表现 评分"). */
function collapseCjkSpaces(text){
  return String(text).replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g,'$1');
}

function detectMetric(text){
  const t=collapseCjkSpaces(text);
  return /Performance\s*Score|戰鬥表現評分|戰鬥表現分|战斗表现评分|战斗表现分|表现评分|表現評分|表现分数|表現分數/i.test(t)?'performanceScore'
    :/\bACS\b/i.test(t)?'acs'
    :/\bADR\b/i.test(t)?'adr'
    :null;
}

function parseResult(text){
  if(/VICTORY|胜利|勝利|获胜|獲勝|\bWIN\b/i.test(text)) return 'W';
  // CN client uses 败北; keep 战败/失败 as fallbacks
  if(/DEFEAT|败北|敗北|战败|戰敗|失败|失敗|\bLOSS\b/i.test(text)) return 'L';
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
  // Localized SC/TC/EN labels embedded in OCR text (substring) — longest first
  const aliasHits=[];
  for(const id of ranked){
    const aliases=(LRCatalog.mapAliases?LRCatalog.mapAliases(id):[id,LRCatalog.mapName(id)]);
    for(const label of aliases){
      if(label&&String(label).length>=2&&text.includes(label)) aliasHits.push({id,len:String(label).length});
    }
  }
  if(aliasHits.length){
    aliasHits.sort((a,b)=>b.len-a.len);
    return aliasHits[0].id;
  }
  for(const part of text.split(/[\n\r|,，/]/).map(x=>x.trim()).filter(Boolean)){
    const hit=LRCatalog.resolveMap(part);
    if(hit&&pool.includes(hit)) return hit;
  }
  return null;
}

function stripMapAliases(text,game){
  if(!window.LRCatalog) return text;
  let cleaned=String(text);
  const pool=LRCatalog.maps[game]||LRCatalog.maps.val||[];
  const labels=[];
  for(const id of pool){
    const aliases=(LRCatalog.mapAliases?LRCatalog.mapAliases(id):[id]);
    for(const a of aliases){ if(a&&String(a).length>=2) labels.push(String(a)); }
  }
  labels.sort((a,b)=>b.length-a.length);
  for(const lab of labels){
    if(cleaned.includes(lab)) cleaned=cleaned.split(lab).join(' ');
  }
  return cleaned;
}

function lineHasLocalMarker(line){
  return /(?:\bYOU\b|自己|本方|▶|►|★|◆)/i.test(line);
}

function plausibleKda(k,d,a){
  return Number.isFinite(k)&&Number.isFinite(d)&&Number.isFinite(a)
    &&k>=0&&d>=0&&a>=0&&k<=60&&d<=50&&a<=50;
}

// 13.06+ Performance Score / CN 表现评分 is 0–500; real games can be 1–19 (old floor 20 dropped those).
function plausibleScore(score){
  return Number.isFinite(score)&&score>=0&&score<=500;
}

/**
 * Recover K/D/A when OCR drops a slash or turns "/" into "1".
 * Only fills gaps: normal two-slash k/d/a matches still win on weight.
 * Never invents values outside plausibleKda.
 */
function pushGluedCand(cands,k,d,a,score,weight){
  if(!plausibleKda(k,d,a)||k+d+a===0) return;
  if(score!=null&&!plausibleScore(score)) score=null;
  cands.push({k,d,a,score,weight});
}

function recoverGluedKda(line){
  const cands=[];
  const s=String(line);

  // A) both slashes read as "1": 14/12/4 → "1411214"
  {
    const re=/(?:^|[^\d])(\d{1,3})\s+(\d{1,2})1(\d{1,2})1(\d{1,2})(?=[^\d]|$)/g;
    let m; while((m=re.exec(s))) pushGluedCand(cands,+m[2],+m[3],+m[4],+m[1],3);
  }
  {
    const re=/(?:^|[^\d])(\d{1,2})1(\d{1,2})1(\d{1,2})(?=[^\d]|$)/g;
    let m; while((m=re.exec(s))) pushGluedCand(cands,+m[1],+m[2],+m[3],null,2);
  }

  // B) one slash kept; other became "1" between single-digit D and A:
  //    19/7/4 → "19/714"; 15/7/7 → "15/717"
  {
    const re=/(?:^|[^\d])(\d{1,3})\s+(\d{1,2})\s*[/|]\s*(\d)1(\d)(?=[^\d]|$)/g;
    let m; while((m=re.exec(s))) pushGluedCand(cands,+m[2],+m[3],+m[4],+m[1],3);
  }
  {
    const re=/(?:^|[^\d])(\d{1,2})\s*[/|]\s*(\d)1(\d)(?=[^\d]|$)/g;
    let m; while((m=re.exec(s))) pushGluedCand(cands,+m[1],+m[2],+m[3],null,2);
  }

  // C) K+D glued, slash before A remains: "2719/11" → 27/19/11
  {
    const re=/(?:^|[^\d])(\d{1,3})\s+(\d{3,4})\s*[/|]\s*(\d{1,2})(?=[^\d]|$)/g;
    let m;
    while((m=re.exec(s))){
      const score=+m[1], glued=m[2], a=+m[3];
      for(let i=1;i<=2;i++){
        if(glued.length-i<1||glued.length-i>2) continue;
        pushGluedCand(cands,+glued.slice(0,i),+glued.slice(i),a,score,3);
      }
    }
  }
  {
    const re=/(?:^|[^\d])(\d{3,4})\s*[/|]\s*(\d{1,2})(?=[^\d]|$)/g;
    let m;
    while((m=re.exec(s))){
      const glued=m[1], a=+m[2];
      for(let i=1;i<=2;i++){
        if(glued.length-i<1||glued.length-i>2) continue;
        pushGluedCand(cands,+glued.slice(0,i),+glued.slice(i),a,null,2);
      }
    }
  }

  // D) D+A glued into exactly 2 digits: "4/72" → 4/7/2 (best-effort; may lose a tens digit)
  {
    const re=/(?:^|[^\d])(\d{1,3})\s+(\d{1,2})\s*[/|]\s*(\d)(\d)(?=[^\d]|$)/g;
    let m; while((m=re.exec(s))) pushGluedCand(cands,+m[2],+m[3],+m[4],+m[1],2);
  }
  {
    const re=/(?:^|[^\d])(\d{1,2})\s*[/|]\s*(\d)(\d)(?=[^\d]|$)/g;
    let m; while((m=re.exec(s))) pushGluedCand(cands,+m[1],+m[2],+m[3],null,1);
  }

  // E) D+A glued into 3–4 digits after one slash:
  //    prefer embedded "1" as slash ("14/1216"→14/12/6, "32/2015"→32/20/5);
  //    else peel last 1–2 digits as A ("32/205"→32/20/5)
  {
    const re=/(?:^|[^\d])(\d{1,3})\s+(\d{1,2})\s*[/|]\s*(\d{3,4})(?=[^\d]|$)/g;
    let m;
    while((m=re.exec(s))){
      const score=+m[1], k=+m[2], rest=m[3];
      const asSlash=rest.match(/^(\d{1,2})1(\d{1,2})$/);
      if(asSlash) pushGluedCand(cands,k,+asSlash[1],+asSlash[2],score,3);
      else{
        for(let al=1;al<=2;al++){
          if(rest.length-al<1||rest.length-al>2) continue;
          pushGluedCand(cands,k,+rest.slice(0,rest.length-al),+rest.slice(rest.length-al),score,1);
        }
      }
    }
  }
  {
    const re=/(?:^|[^\d])(\d{1,2})\s*[/|]\s*(\d{3,4})(?=[^\d]|$)/g;
    let m;
    while((m=re.exec(s))){
      const k=+m[1], rest=m[2];
      const asSlash=rest.match(/^(\d{1,2})1(\d{1,2})$/);
      if(asSlash) pushGluedCand(cands,k,+asSlash[1],+asSlash[2],null,2);
      else{
        for(let al=1;al<=2;al++){
          if(rest.length-al<1||rest.length-al>2) continue;
          pushGluedCand(cands,k,+rest.slice(0,rest.length-al),+rest.slice(rest.length-al),null,1);
        }
      }
    }
  }

  cands.sort((a,b)=>b.weight-a.weight||(b.score!=null)-(a.score!=null));
  const seen=new Set(), out=[];
  for(const c of cands){
    const key=c.k+'/'+c.d+'/'+c.a+'@'+(c.score??'');
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function lineHasNaturalKda(line){
  return /\d{1,2}\s*[/|]\s*\d{1,2}\s*[/|]\s*\d{1,2}/.test(line);
}

/** Collect bare scoreboard rows: optional combat score then K/D/A. */
function collectScoreboardRows(text){
  const rows=[];
  const lines=String(text).split(/\r?\n/);
  for(let li=0;li<lines.length;li++){
    const line=lines[li];
    let prevScore=null;
    if(li>0){
      const pm=lines[li-1].match(/(?:^|\s)(\d{1,3})\s*$/);
      if(pm&&plausibleScore(+pm[1])) prevScore=+pm[1];
    }
    // "Mint 80 6/16/5" / "400 28/17/5" — score immediately before K/D/A
    const withScore=line.match(/(\d{1,3})\s+(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/g);
    if(withScore){
      for(const chunk of withScore){
        const m=chunk.match(/(\d{1,3})\s+(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/);
        if(!m) continue;
        const score=+m[1],k=+m[2],d=+m[3],a=+m[4];
        if(!plausibleScore(score)||!plausibleKda(k,d,a)) continue;
        let weight=2;
        if(lineHasLocalMarker(line)) weight+=5;
        rows.push({k,d,a,score,weight,line,li});
      }
    }
    // Bare "30/16/2" on a line (CN scoreboard often has no K/D/A label)
    const bare=line.match(/(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/g);
    if(bare){
      for(const chunk of bare){
        const m=chunk.match(/(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/);
        if(!m) continue;
        const k=+m[1],d=+m[2],a=+m[3];
        if(!plausibleKda(k,d,a)) continue;
        if(k+d+a===0) continue;
        let weight=1;
        if(lineHasLocalMarker(line)) weight+=5;
        if(prevScore!=null) weight+=1;
        rows.push({k,d,a,score:prevScore,weight,line,li});
      }
    }
    // Slash-glue recovery (missing "/" or "/"→"1"). High-confidence glued hits can outrank a
    // wrong natural row on the same noisy OCR line (weight 3 with score vs natural 2).
    for(const g of recoverGluedKda(line)){
      let weight=g.weight;
      if(lineHasLocalMarker(line)) weight+=5;
      let score=g.score;
      if(score==null&&prevScore!=null){ score=prevScore; weight+=1; }
      rows.push({k:g.k,d:g.d,a:g.a,score,weight,line,li,glued:true});
    }
  }
  // Whole-text fallback when OCR collapsed newlines ("… 30/16/2 …")
  if(!rows.length){
    const re=/(\d{1,3})\s+(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/g;
    let m;
    while((m=re.exec(text))){
      const score=+m[1],k=+m[2],d=+m[3],a=+m[4];
      if(!plausibleScore(score)||!plausibleKda(k,d,a)) continue;
      rows.push({k,d,a,score,weight:2,line:m[0],li:-1});
    }
  }
  if(!rows.length){
    const re=/(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/g;
    let m;
    while((m=re.exec(text))){
      const k=+m[1],d=+m[2],a=+m[3];
      if(!plausibleKda(k,d,a)||k+d+a===0) continue;
      rows.push({k,d,a,score:null,weight:1,line:m[0],li:-1});
    }
  }
  return rows;
}

function pickScoreboardRow(rows,agentHintText){
  if(!rows.length) return null;
  // Boost rows that mention an agent name (local row often shows agent)
  if(window.LRCatalog&&agentHintText){
    for(const row of rows){
      const hit=matchAgentIn(row.line, agentHintText, {requireNearNumbers:false, shortOk:true});
      if(hit) row.weight+=3;
    }
  }
  rows.sort((a,b)=>b.weight-a.weight||(b.score!=null)-(a.score!=null));
  // If many equal-weight bare rows (full board), prefer ones with a score attached
  const top=rows[0].weight;
  const best=rows.filter(r=>r.weight===top);
  if(best.length===1) return best[0];
  const withScore=best.filter(r=>r.score!=null);
  if(withScore.length===1) return withScore[0];
  if(withScore.length>1) return withScore[0];
  // Few rows (cropped) → first; many rows without markers → still first plausible
  return best[0];
}

function matchAgentIn(scope,fullText,opts){
  if(!window.LRCatalog) return null;
  const shortOk=opts&&opts.shortOk;
  const list=LRCatalog.agents.slice().sort((a,b)=>b.length-a.length);

  for(const id of list){
    const esc=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('\\b'+esc+'\\b','i');
    if(!re.test(scope)) continue;
    // Short EN names (Omen, Iso, …) are easy false positives in noisy OCR.
    // Accept only when the matching line looks like a scoreboard/agent row —
    // not UI tip chrome like "Omen tip card ignored".
    if(id.length<=4){
      const ok=scope.split(/\r?\n/).some(line=>{
        if(!re.test(line)) return false;
        if(lineHasLocalMarker(line)||/\d\s*[/|]\s*\d/.test(line)) return true;
        if(/[\u4e00-\u9fff]/.test(line)) return true; // e.g. "雷兹 Raze"
        const rest=line.replace(re,' ').replace(/[^\w\u4e00-\u9fff]+/g,' ').trim();
        return !rest; // lone agent token line
      });
      if(!ok) continue;
    }
    return id;
  }

  // CN/TC aliases — longest label first; scope should already have map aliases stripped
  const aliasHits=[];
  for(const id of list){
    const aliases=(LRCatalog.agentAliases?LRCatalog.agentAliases(id):[id,LRCatalog.agentName(id)]);
    for(const label of aliases){
      if(!label||String(label).length<2) continue;
      if(label===id) continue; // already handled via word-boundary above
      if(scope.includes(label)) aliasHits.push({id,len:String(label).length,label:String(label)});
    }
  }
  if(aliasHits.length){
    aliasHits.sort((a,b)=>b.len-a.len);
    return aliasHits[0].id;
  }

  for(const part of scope.split(/[\n\r|,，]/).map(x=>x.trim()).filter(Boolean)){
    if(part.length<2||part.length>24) continue;
    const hit=LRCatalog.resolveAgent(part);
    if(hit&&LRCatalog.agents.includes(hit)){
      if(hit.length<=4&&!shortOk){ const ok=scope.split(/\r?\n/).some(line=>line.includes(part)&&(lineHasLocalMarker(line)||/\d\s*[/|]\s*\d/.test(line))); if(!ok) continue; }
      return hit;
    }
  }
  return null;
}

function parseAgent(text,game,hintLine,hintLi){
  if(!window.LRCatalog) return null;
  const g=game||'val';
  const cleaned=stripMapAliases(text,g);
  const lines=cleaned.split(/\r?\n/);
  // Prefer a window around the picked scoreboard row (agent name often sits on an adjacent line)
  if(hintLine||(hintLi!=null&&hintLi>=0)){
    const chunks=[];
    if(hintLi!=null&&hintLi>=0){
      for(let i=Math.max(0,hintLi-2);i<=Math.min(lines.length-1,hintLi+2);i++) chunks.push(lines[i]);
    }
    if(hintLine) chunks.unshift(stripMapAliases(hintLine,g));
    const nearScope=chunks.join('\n');
    const near=matchAgentIn(nearScope, cleaned, {shortOk:true});
    if(near) return near;
  }
  // Lines that already carry K/D/A-like numbers (or local marker)
  for(const line of lines){
    if(!/\d\s*[/|]\s*\d/.test(line)&&!lineHasLocalMarker(line)) continue;
    const hit=matchAgentIn(line, cleaned, {shortOk:true});
    if(hit) return hit;
  }
  // CN aliases / longer EN names anywhere (short EN still need a numeric neighbour line)
  return matchAgentIn(cleaned, cleaned, {shortOk:false});
}

function suggestions(text,game){
  const out={};
  const g=game||'val';
  const raw=collapseCjkSpaces(String(text||''));

  // 1) Labeled K/D/A (English / explicit headers)
  const kda=raw.match(/\bK\s*[/|]\s*D\s*[/|]\s*A\s*[:：]?\s*(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})\b/i);
  if(kda)[out.k,out.d,out.a]=kda.slice(1).map(Number);
  if(out.k==null){
    const compact=raw.match(/(?:K\s*[/|]\s*D\s*[/|]\s*A|KDA|击杀|擊殺)[^\d]{0,12}(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})/i);
    if(compact)[out.k,out.d,out.a]=compact.slice(1).map(Number);
  }

  // 2) Bare CN scoreboard rows: "30/16/2" or "Mint 80 6/16/5"
  let picked=null;
  if(out.k==null||out.score==null){
    const rows=collectScoreboardRows(raw);
    picked=pickScoreboardRow(rows, raw);
    if(picked){
      if(out.k==null){ out.k=picked.k; out.d=picked.d; out.a=picked.a; }
      if(out.score==null&&picked.score!=null) out.score=picked.score;
    }
  }

  const fields={
    k:/(?:\bKills?\b|击杀|擊殺)\s*[:：]\s*(\d{1,2})/i,
    d:/(?:\bDeaths?\b|死亡)\s*[:：]\s*(\d{1,2})/i,
    a:/(?:\bAssists?\b|助攻)\s*[:：]\s*(\d{1,2})/i,
    score:/(?:Performance\s*Score|表現分數|表現評分|戰鬥表現評分|戰鬥表現分|战斗表现评分|战斗表现分|表现评分|表现分数|\bACS\b|\bADR\b)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i,
    hs:/(?:Headshot\s*%?|爆头率|爆頭率|\bHS%)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i
  };
  const metric=detectMetric(raw);
  if(metric==='performanceScore') fields.score=/(?:Performance\s*Score|表現分數|表現評分|戰鬥表現評分|戰鬥表現分|战斗表现评分|战斗表现分|表现评分|表现分数)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i;
  else if(metric==='acs') fields.score=/\bACS\b\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i;
  else if(metric==='adr') fields.score=/\bADR\b\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)/i;
  for(const [k,re] of Object.entries(fields)){
    if(out[k]!=null) continue;
    const m=raw.match(re);
    if(m) out[k]=Number(m[1]);
  }

  const result=parseResult(raw);
  if(result) out.result=result;
  const map=parseMap(raw,g);
  if(map) out.map=map;
  const agent=parseAgent(raw,g, picked&&picked.line, picked&&picked.li);
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
    // Mild upscale on short edge (own-row strips): if min<80 → toward 120, cap ×3.
    const short=Math.min(cw,ch);
    if(short<80){
      const s=Math.min(3,120/short);
      cw=Math.max(1,Math.round(cw*s));
      ch=Math.max(1,Math.round(ch*s));
    }
    const maxSide=Math.max(cw,ch);
    if(maxSide>1600){const s=1600/maxSide;cw=Math.max(1,Math.round(cw*s));ch=Math.max(1,Math.round(ch*s));}
    const crop=document.createElement('canvas');crop.width=cw;crop.height=ch;
    const ctx=crop.getContext('2d');
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(image,sx,sy,sw,sh,0,0,cw,ch);
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
        corePath:base+'tesseract-core-lstm.wasm.js',
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
