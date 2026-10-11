/* Shared catalog. sc = mainland China; tc = HK/international Traditional Chinese.
   Map names: Riot zh-TW maps / Tencent mainland client. Not the current ranked rotation. */
(function(){
'use strict';
const names={"Summit": ["天枢云阙", "頂峰亭閣"], "Abyss": ["幽邃地窟", "深窟幽境"], "Ascent": ["亚海悬城", "義境空島"], "Bind": ["源工重镇", "劫境之地"], "Breeze": ["微风岛屿", "熱帶樂園"], "Corrode": ["盐海矿镇", "晶蝕之地"], "Fracture": ["裂变峡谷", "天漠之峽"], "Haven": ["隐世修所", "遺落境地"], "Icebox": ["森寒冬港", "極地寒港"], "Lotus": ["莲华古城", "蓮華古城"], "Pearl": ["深海明珠", "深海遺珠"], "Split": ["霓虹町", "雙塔迷城"], "Sunset": ["日落之城", "日落之城"], "Ancient": ["远古遗迹", "遠古遺跡"], "Anubis": ["阿努比斯", "阿努比斯"], "Dust2": ["炙热沙城Ⅱ", "熾熱沙城Ⅱ"], "Inferno": ["炼狱小镇", "煉獄小鎮"], "Mirage": ["荒漠迷城", "荒漠迷城"], "Nuke": ["核子危机", "核子危機"], "Overpass": ["死亡游乐园", "死亡遊樂園"], "Train": ["列车停放站", "列車停放站"], "Vertigo": ["殒命大厦", "殞命大廈"]};
const maps={val:["Summit", "Abyss", "Ascent", "Bind", "Breeze", "Corrode", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset"],cs2:["Ancient", "Anubis", "Dust2", "Inferno", "Mirage", "Nuke", "Overpass", "Train", "Vertigo"]};
const agentNames={"Gekko": ["盖可", "蓋克"], "Fade": ["黑梦", "菲德"], "Breach": ["铁臂", "叛奇"], "Deadlock": ["钢锁", "蒂羅"], "Tejo": ["钛狐", "戴侯"], "Raze": ["雷兹", "芮茲"], "Chamber": ["尚勃勒", "錢博爾"], "KAY/O": ["K/O", "KAY/O"], "Skye": ["斯凯", "絲凱"], "Cypher": ["零", "瑟符"], "Sova": ["猎枭", "蘇法"], "Miks": ["迷核", "米克什"], "Killjoy": ["奇乐", "愷宙"], "Harbor": ["海神", "哈泊"], "Vyse": ["维斯", "薇絲"], "Viper": ["蝰蛇", "薇蝮"], "Phoenix": ["不死鸟", "菲尼克斯"], "Veto": ["禁灭", "維托"], "Astra": ["星礈", "亞星卓"], "Brimstone": ["炼狱", "布史東"], "Iso": ["壹决", "離索"], "Clove": ["暮蝶", "珂樂芙"], "Neon": ["霓虹", "妮虹"], "Yoru": ["夜露", "夜戮"], "Waylay": ["幻棱", "維蕾"], "Sage": ["贤者", "聖祈"], "Reyna": ["芮娜", "蕾娜"], "Omen": ["幽影", "歐門"], "Jett": ["捷风", "婕提"]};
const agents=["Astra", "Breach", "Brimstone", "Chamber", "Clove", "Cypher", "Deadlock", "Fade", "Gekko", "Harbor", "Iso", "Jett", "KAY/O", "Killjoy", "Miks", "Neon", "Omen", "Phoenix", "Raze", "Reyna", "Sage", "Skye", "Sova", "Tejo", "Veto", "Viper", "Vyse", "Waylay", "Yoru"];
const agentRoles={"Gekko": "initiator", "Fade": "initiator", "Breach": "initiator", "Deadlock": "sentinel", "Tejo": "initiator", "Raze": "duelist", "Chamber": "sentinel", "KAY/O": "initiator", "Skye": "initiator", "Cypher": "sentinel", "Sova": "initiator", "Miks": "controller", "Killjoy": "sentinel", "Harbor": "controller", "Vyse": "sentinel", "Viper": "controller", "Phoenix": "duelist", "Veto": "sentinel", "Astra": "controller", "Brimstone": "controller", "Iso": "duelist", "Clove": "controller", "Neon": "duelist", "Yoru": "duelist", "Waylay": "duelist", "Sage": "sentinel", "Reyna": "duelist", "Omen": "controller", "Jett": "duelist"};
function mapName(id){ const n=names[id]; return n?(LR.lang==='en'?id:n[LR.lang==='tc'?1:0]):id; }
function agentName(id){const n=agentNames[id];return n?(LR.lang==='en'?id:n[LR.lang==='tc'?1:0]):id;}
function roleFor(agent){return agentRoles[agent]||'';}
function metricType(m){return typeof m.metricType==='string'?m.metricType:(m.game==='cs2'?'adr':'acs');}
function metricLabel(m){const k=typeof m==='string'?(m==='cs2'?'adr':'performanceScore'):metricType(m);return k==='performanceScore'?LR.raw('m.ps'):k==='trackerScore'?'Tracker Score':['acs','adr'].includes(k)?k.toUpperCase():LR.raw('m.unknown');}
function derived(m){
 const finite=v=>typeof v==='number'&&Number.isFinite(v), n=finite(m.rounds)&&m.rounds>0?m.rounds:null;
 return {kd:finite(m.k)&&finite(m.d)?(m.d===0?(m.k>0?'∞':'—'):(m.k/m.d).toFixed(2)):'—',delta:finite(m.k)&&finite(m.d)?m.k-m.d:null,adr:n&&finite(m.damageDealt)?m.damageDealt/n:(finite(m.adr)?m.adr:m.game==='cs2'&&finite(m.score)?m.score:null),dd:n&&finite(m.damageDealt)&&finite(m.damageReceived)?(m.damageDealt-m.damageReceived)/n:(finite(m.damageDelta)?m.damageDelta:null)};
}
function resolveMap(value){return Object.keys(names).find(id=>id.toLowerCase()===value.toLowerCase()||names[id].includes(value))||value;}
function resolveAgent(value){return agents.find(id=>id.toLowerCase()===value.toLowerCase()||agentNames[id].includes(value))||value;}
window.LRCatalog={resolveMap,resolveAgent,maps,agents,mapName,agentName,roleFor,metricType,metricLabel,derived};
})();
