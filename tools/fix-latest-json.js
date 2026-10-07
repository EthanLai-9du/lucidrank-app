// CI helper: rewrite the latest.json that tauri-action uploaded.
//  - notes  <- src-tauri/update-notes.txt (one line per language: "sc: …", "tc: …", "en: …"), LF only
//  - url    <- the public https://github.com/<repo>/releases/download/<tag>/<file> link instead of the
//              api.github.com asset URL (no API rate limit, same file)
// usage: node tools/fix-latest-json.js latest.json release.json update-notes.txt
const fs=require('fs');
const [jf,rf,nf]=process.argv.slice(2);
const j=JSON.parse(fs.readFileSync(jf,'utf8')), rel=JSON.parse(fs.readFileSync(rf,'utf8'));
const byApi=Object.fromEntries(rel.assets.map(a=>[a.url,a.browser_download_url]));
j.notes=fs.readFileSync(nf,'utf8').replace(/\r/g,'').trim();
for(const [k,p] of Object.entries(j.platforms)){
  if(byApi[p.url]) p.url=byApi[p.url];
  if(!/^https:\/\/github\.com\//.test(p.url)) throw new Error(`unexpected url for ${k}: ${p.url}`);
}
fs.writeFileSync(jf,JSON.stringify(j,null,2)+'\n');
console.log(Object.entries(j.platforms).map(([k,p])=>`${k} -> ${p.url}`).join('\n'));
