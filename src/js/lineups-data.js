/* LucidRank desktop: EXAMPLE lineup data.
   Everything here is made up for the prototype: abstract maps (not real layouts), illustrative spots,
   no Riot / Valve assets. Map / agent / ability names are only used as labels. */
(function(){
'use strict';
const L=(sc,tc,en)=>({sc,tc:tc||sc,en});
// Abstract minimaps on a 100×100 grid: areas = [x,y,w,h], sites = label positions, spawns.
const MAPS={
  val:{
    Ascent:{areas:[[8,12,28,22],[64,14,28,22],[40,40,22,20],[10,38,12,36],[76,40,12,34],[22,74,56,12],[36,8,28,10],[22,52,18,8],[62,52,14,8]],sites:{A:[22,22],B:[78,24]},atk:[50,84],def:[50,12],mid:[51,50]},
    Bind:{areas:[[8,14,30,24],[62,14,30,24],[12,42,12,36],[76,42,12,36],[24,72,52,14],[38,40,24,10],[30,8,40,10]],sites:{A:[22,26],B:[77,26]},atk:[50,80],def:[50,12],tp:[[18,60],[82,60]]},
    Haven:{areas:[[6,16,22,20],[40,20,20,18],[72,16,22,20],[10,40,10,34],[45,42,10,28],[80,40,10,34],[14,74,72,12],[28,6,44,10]],sites:{A:[17,25],B:[50,29],C:[83,25]},atk:[50,82],def:[50,10]},
  },
  cs2:{
    Mirage:{areas:[[62,12,28,24],[10,16,26,22],[40,40,20,18],[70,40,12,36],[14,42,12,30],[24,74,58,12],[36,10,22,10]],sites:{A:[76,24],B:[23,27]},atk:[54,82],def:[46,14],mid:[50,49]},
    Inferno:{areas:[[64,40,26,24],[18,8,30,24],[28,34,12,30],[64,68,14,16],[38,66,26,14],[8,64,22,12],[48,14,16,10]],sites:{A:[77,52],B:[33,20]},atk:[20,88],def:[60,18]},
    Dust2:{areas:[[66,10,26,22],[8,10,26,24],[42,20,14,50],[78,34,12,36],[10,38,12,30],[22,72,58,12],[56,40,22,10]],sites:{A:[79,21],B:[21,22]},atk:[50,88],def:[50,14],mid:[49,45]},
  },
};
const AGENTS=['Sova','Viper','Brimstone','Killjoy'];
const UTIL=['smoke','flash','molly'];
const ABIL={
  recon:L('侦查箭','偵查箭','Recon Bolt'), shock:L('震击箭','震擊箭','Shock Dart'), incen:L('燃烧弹','燃燒彈','Incendiary'),
  nano:L('纳米蜂群','納米蜂群','Nanoswarm'), snake:L('蛇咬','蛇咬','Snake Bite'), wall:L('毒幕','毒幕','Toxic Screen'),
  smoke:L('烟雾弹','煙霧彈','Smoke'), flash:L('闪光弹','閃光彈','Flash'), molly:L('燃烧瓶','燃燒瓶','Molotov'),
};
const UTIL_NAME={smoke:ABIL.smoke,flash:ABIL.flash,molly:ABIL.molly};
// s = stand, m = aim point, l = landing (grid coords) · throw = key in I18N 'lu.t.*'
const LINEUPS=[
  // ---- VALORANT · Ascent
  {id:'v-asc-1',game:'val',map:'Ascent',agent:'Sova',ab:'recon',side:'atk',scn:'exec',site:'A',to:L('A 点后排','A 點後排','back of A site'),
   s:[16,66],m:[17,44],l:[20,20],throw:'b1',stand:L('A 大道口左边箱子角','A 大道口左邊箱角','left box corner at A main'),aim:L('正前方屋檐的尖角','正前方屋簷尖角','tip of the roof edge straight ahead')},
  {id:'v-asc-2',game:'val',map:'Ascent',agent:'Sova',ab:'shock',side:'atk',scn:'post',site:'A',to:L('A 默认包点','A 預設包位','A default plant'),
   s:[28,58],m:[26,40],l:[23,24],throw:'b2',stand:L('A 小道拐角贴墙','A 小道轉角貼牆','tight on the A short corner'),aim:L('塔顶窗框左下角','塔頂窗框左下角','lower-left of the tower window frame')},
  {id:'v-asc-3',game:'val',map:'Ascent',agent:'Brimstone',ab:'incen',side:'atk',scn:'post',site:'B',to:L('B 默认包点','B 預設包位','B default plant'),
   s:[80,62],m:[79,44],l:[78,26],throw:'stand',stand:L('B 大道中间那块地砖','B 大道中間那塊地磚','middle tile of B main'),aim:L('远处拱门的顶端','遠處拱門頂端','top of the far archway')},
  {id:'v-asc-4',game:'val',map:'Ascent',agent:'Killjoy',ab:'nano',side:'def',scn:'hold',site:'A',to:L('A 小道出口','A 小道出口','A short exit'),
   s:[22,18],m:[24,30],l:[26,40],throw:'place',stand:L('A 点平台后面','A 點平台後面','behind the A platform'),aim:L('出口门槛内侧','出口門檻內側','just inside the doorway')},
  {id:'v-asc-5',game:'val',map:'Ascent',agent:'Viper',ab:'snake',side:'atk',scn:'post',site:'B',to:L('B 包点后侧','B 包位後側','behind B plant'),
   s:[74,70],m:[76,50],l:[80,28],throw:'jump',stand:L('B 大道入口右侧墙角','B 大道入口右側牆角','right corner at B main entrance'),aim:L('天线最高点','天線最高點','highest point of the antenna')},
  // ---- VALORANT · Bind
  {id:'v-bind-1',game:'val',map:'Bind',agent:'Viper',ab:'wall',side:'atk',scn:'exec',site:'A',to:L('A 点一字墙','A 點一字牆','straight wall across A'),
   s:[18,70],m:[20,48],l:[22,28],throw:'place',stand:L('A 短道楼梯下','A 短道樓梯下','under the A short stairs'),aim:L('对面墙上的灯','對面牆上的燈','lamp on the far wall')},
  {id:'v-bind-2',game:'val',map:'Bind',agent:'Sova',ab:'recon',side:'atk',scn:'exec',site:'B',to:L('B 点中间','B 點中間','middle of B'),
   s:[82,68],m:[80,46],l:[77,26],throw:'b1',stand:L('B 长道尽头箱子旁','B 長道盡頭箱旁','next to the box at the end of B long'),aim:L('屋顶横梁中点','屋頂橫樑中點','middle of the roof beam')},
  {id:'v-bind-3',game:'val',map:'Bind',agent:'Brimstone',ab:'incen',side:'atk',scn:'post',site:'A',to:L('A 默认包点','A 預設包位','A default plant'),
   s:[30,76],m:[26,52],l:[22,26],throw:'stand',stand:L('A 澡堂出口左侧','A 澡堂出口左側','left side of the A bath exit'),aim:L('烟囱右边缘','煙囪右邊緣','right edge of the chimney')},
  {id:'v-bind-4',game:'val',map:'Bind',agent:'Killjoy',ab:'nano',side:'def',scn:'hold',site:'B',to:L('B 窗口下','B 窗口下','under B window'),
   s:[78,18],m:[80,30],l:[82,40],throw:'place',stand:L('B 点箱子后','B 點箱後','behind the B box'),aim:L('窗台下沿','窗台下沿','bottom edge of the window')},
  // ---- VALORANT · Haven
  {id:'v-hav-1',game:'val',map:'Haven',agent:'Sova',ab:'recon',side:'atk',scn:'exec',site:'C',to:L('C 点后排','C 點後排','back of C'),
   s:[84,70],m:[84,48],l:[84,22],throw:'b2',stand:L('C 长道起点墙边','C 長道起點牆邊','wall at the start of C long'),aim:L('远处屋顶的白色标记','遠處屋頂的白色標記','white mark on the far roof')},
  {id:'v-hav-2',game:'val',map:'Haven',agent:'Viper',ab:'snake',side:'atk',scn:'post',site:'A',to:L('A 默认包点','A 預設包位','A default plant'),
   s:[14,68],m:[15,46],l:[17,24],throw:'jump',stand:L('A 长道中段柱子后','A 長道中段柱後','behind the pillar in A long'),aim:L('塔楼窗户上沿','塔樓窗戶上沿','top of the tower window')},
  {id:'v-hav-3',game:'val',map:'Haven',agent:'Sova',ab:'shock',side:'def',scn:'retake',site:'B',to:L('B 点中间','B 點中間','middle of B'),
   s:[50,12],m:[50,20],l:[50,30],throw:'b1',stand:L('B 后点出口','B 後點出口','B back exit'),aim:L('正前方门框顶','正前方門框頂','top of the doorframe ahead')},
  // ---- CS2 · Mirage
  {id:'c-mir-1',game:'cs2',map:'Mirage',util:'smoke',ab:'smoke',side:'atk',scn:'exec',site:'A',to:L('CT 位','CT 位','CT'),
   s:[78,72],m:[76,50],l:[70,18],throw:'jump',stand:L('A 大道墙角，背贴木箱','A 大道牆角，背貼木箱','A ramp corner, back to the crate'),aim:L('天线左边第二根','天線左邊第二根','second antenna from the left')},
  {id:'c-mir-2',game:'cs2',map:'Mirage',util:'smoke',ab:'smoke',side:'atk',scn:'exec',site:'A',to:L('丛林','叢林','jungle'),
   s:[74,78],m:[72,56],l:[64,30],throw:'jump',stand:L('A 大道入口右边砖缝','A 大道入口右邊磚縫','brick seam right of A entrance'),aim:L('屋檐与墙的交角','屋簷與牆交角','where the roof meets the wall')},
  {id:'c-mir-3',game:'cs2',map:'Mirage',util:'flash',ab:'flash',side:'atk',scn:'exec',site:'B',to:L('B 点上空','B 點上空','over B'),
   s:[20,66],m:[22,48],l:[23,28],throw:'right',stand:L('B 公寓出口内侧','B 公寓出口內側','inside the B apartments exit'),aim:L('头顶窗框','頭頂窗框','window frame above you')},
  {id:'c-mir-4',game:'cs2',map:'Mirage',util:'molly',ab:'molly',side:'def',scn:'retake',site:'A',to:L('A 默认包点','A 預設包位','A default plant'),
   s:[56,18],m:[64,22],l:[76,26],throw:'run',stand:L('CT 位箱子旁','CT 位箱旁','next to the CT box'),aim:L('远处墙上的裂缝','遠處牆上的裂縫','crack on the far wall')},
  // ---- CS2 · Inferno
  {id:'c-inf-1',game:'cs2',map:'Inferno',util:'smoke',ab:'smoke',side:'atk',scn:'exec',site:'B',to:L('B 点 CT 口','B 點 CT 口','B CT entrance'),
   s:[34,58],m:[34,40],l:[40,16],throw:'jump',stand:L('香蕉道中段花坛边','香蕉道中段花壇邊','by the planter mid-banana'),aim:L('教堂屋顶尖','教堂屋頂尖','church roof peak')},
  {id:'c-inf-2',game:'cs2',map:'Inferno',util:'molly',ab:'molly',side:'def',scn:'hold',site:'B',to:L('香蕉道前段','香蕉道前段','front of banana'),
   s:[32,24],m:[33,34],l:[34,48],throw:'run',stand:L('B 点车后','B 點車後','behind the car on B'),aim:L('路灯顶','街燈頂','top of the streetlight')},
  {id:'c-inf-3',game:'cs2',map:'Inferno',util:'flash',ab:'flash',side:'atk',scn:'exec',site:'A',to:L('A 点上空','A 點上空','over A'),
   s:[50,72],m:[60,62],l:[74,52],throw:'right',stand:L('A 小道拐角','A 小道轉角','A short corner'),aim:L('阳台栏杆','陽台欄杆','balcony railing')},
  // ---- CS2 · Dust2
  {id:'c-d2-1',game:'cs2',map:'Dust2',util:'smoke',ab:'smoke',side:'atk',scn:'exec',site:'mid',to:L('中路 X 箱','中路 X 箱','mid xbox'),
   s:[48,82],m:[48,62],l:[49,40],throw:'jump',stand:L('T 出生点斜坡上沿','T 出生點斜坡上沿','top of the T spawn slope'),aim:L('远处塔顶左角','遠處塔頂左角','left corner of the far tower')},
  {id:'c-d2-2',game:'cs2',map:'Dust2',util:'flash',ab:'flash',side:'atk',scn:'exec',site:'A',to:L('A 大道','A 大道','A long'),
   s:[82,66],m:[84,52],l:[82,36],throw:'right',stand:L('A 大门内侧','A 大門內側','inside the long doors'),aim:L('门框上沿','門框上沿','top of the doorframe')},
  {id:'c-d2-3',game:'cs2',map:'Dust2',util:'molly',ab:'molly',side:'atk',scn:'post',site:'B',to:L('B 默认包点','B 預設包位','B default plant'),
   s:[16,62],m:[18,44],l:[21,24],throw:'stand',stand:L('B 洞口外墙边','B 洞口外牆邊','outside B tunnels by the wall'),aim:L('窗户下沿','窗戶下沿','bottom of the window')},
];
window.LRLineups={MAPS,AGENTS,UTIL,ABIL,UTIL_NAME,LINEUPS};
})();
