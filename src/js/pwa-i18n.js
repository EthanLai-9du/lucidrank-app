/* LucidRank web (PWA): extra strings and a few web-specific overrides of the shared desktop strings.
   Loaded after the shared js/i18n.js and before core.js. sc = 简体 · tc = 繁體 (HK) · en. */
Object.assign(I18N,{
  /* overrides: desktop wording that doesn't fit a phone / tablet */
  'm.ocrP': {sc:'截图保留压缩小图；登录后随记录同步。数值请核对后填写。', tc:'截圖保留壓縮小圖；登入後隨記錄同步。數值請核對後填寫。', en:'A small screenshot copy is kept and synced when signed in. Review numbers before saving.'},
  's.dataP': {sc:'未登录时保存在本机；登录后可同步到云端。请保存账号恢复码，并定期导出备份。', tc:'未登入時儲存在本機；登入後可同步到雲端。請保存帳戶復原碼，並定期匯出備份。', en:'Guest data stays on this device. Sign in for cloud sync. Save your recovery code and export regular backups.'},
  's.exported': {sc:'已导出 {p}', tc:'已匯出 {p}', en:'Exported {p}'},

  /* bottom tab bar (short labels) */
  'tab.week': {sc:'本周', tc:'本週', en:'Week'},
  'tab.lineups': {sc:'点位', tc:'點位', en:'Lineups'},

  /* settings (web) */
  'web.install': {sc:'添加到主屏幕', tc:'加入主畫面', en:'Add to Home Screen'},
  'web.installP': {sc:'像 App 一样打开，没网也能用。', tc:'像 App 一樣開啟，沒有網絡也能用。', en:'Opens like an app and works offline.'},
  'web.installBtn': {sc:'安装', tc:'安裝', en:'Install'},
  'web.installIOS': {sc:'点 Safari 的分享按钮 {i}，再点「添加到主屏幕」。', tc:'按 Safari 的分享按鈕 {i}，再按「加入主畫面」。', en:'Tap Share {i} in Safari, then “Add to Home Screen”.'},
  'web.installOther': {sc:'在浏览器菜单里选「添加到主屏幕」或「安装应用」。', tc:'在瀏覽器選單揀「加到主畫面」或「安裝應用程式」。', en:'Use the browser menu: “Add to Home screen” or “Install app”.'},
  'web.installed': {sc:'已经在主屏幕上了。', tc:'已經在主畫面。', en:'It’s on your Home Screen.'},
  'web.remind': {sc:'提醒', tc:'提醒', en:'Reminders'},
  'web.remindP': {sc:'开游戏时提醒签到，目前只有电脑版有。这里打开就能签。', tc:'開遊戲時提醒簽到，暫時只有電腦版有。這裡打開就可以簽。', en:'Game-start reminders are desktop-only for now. Here, just open it and check in.'},
  'web.import': {sc:'导入 JSON', tc:'匯入 JSON', en:'Import JSON'},
  'web.importQ': {sc:'导入 {c} 天签到、{m} 局对局？会和现有数据合并，同一天的签到保留较新的那条。', tc:'匯入 {c} 天簽到、{m} 局對局？會和現有數據合併，同一天的簽到保留較新的一筆。', en:'Import {c} check-ins and {m} games? They’ll be merged with what’s here. For the same day, the newer check-in wins.'},
  'web.importBtn': {sc:'导入', tc:'匯入', en:'Import'},
  'web.imported': {sc:'导入好了', tc:'匯入完成', en:'Imported'},
  'web.importBad': {sc:'这个文件读不了，不是 LucidRank 的数据。', tc:'讀取不到這個檔案，不是 LucidRank 的數據。', en:'Can’t read that file. It isn’t LucidRank data.'},
  'web.compat': {sc:'格式和电脑版的 lucidrank-data.json 相同。电脑版导出的文件可以直接导入；这里导出的文件，在电脑上退出 LucidRank 后替换掉 lucidrank-data.json 就能用。', tc:'格式和電腦版的 lucidrank-data.json 相同。電腦版匯出的檔案可以直接匯入；這裡匯出的檔案，在電腦結束 LucidRank 後取代 lucidrank-data.json 就可以用。', en:'Same format as the desktop app’s lucidrank-data.json. Desktop exports import here directly. To move this data to your PC, quit LucidRank there and replace lucidrank-data.json with the exported file.'},
  'web.backup': {sc:'浏览器在空间不够或很久不用时可能清掉网站数据（iPhone / iPad 没添加到主屏幕时更容易）。隔一阵导出一次备份。', tc:'瀏覽器在空間不足或很久沒用時可能清除網站數據（iPhone / iPad 未加入主畫面時更容易）。間中匯出一次備份。', en:'Browsers can clear site data when space runs low or after long disuse (more likely on iPhone / iPad if it isn’t on the Home Screen). Export a backup now and then.'},
  'web.aboutP': {sc:'v{v} 网页版 · 原型版本。功能和数据格式之后可能会变。', tc:'v{v} 網頁版 · 原型版本。功能和數據格式之後可能會變。', en:'v{v} web · Prototype. Features and data format may change.'},
  'web.desktop': {sc:'Windows 版下载', tc:'下載 Windows 版', en:'Get the Windows app'},

  /* install hint (first visits) */
  'web.dismiss': {sc:'知道了', tc:'知道了', en:'Got it'},
  'web.later': {sc:'以后再说', tc:'稍後再說', en:'Not now'},

  /* misc */
  'web.delQ': {sc:'删掉这局？', tc:'刪除這局？', en:'Delete this game?'},
  'web.updated': {sc:'有新版本', tc:'有新版本', en:'New version ready'},
  'web.reload': {sc:'刷新', tc:'重新載入', en:'Reload'},
  'web.shotRemote': {sc:'这张截图在电脑上，这台设备没有。', tc:'這張截圖在電腦上，這部裝置沒有。', en:'That screenshot is on your PC, not this device.'},
  'web.shotGone': {sc:'找不到这张截图了。', tc:'找不到這張截圖。', en:'Screenshot not found.'},
});

Object.assign(I18N,{'website.back':{sc:'← 返回官网',tc:'← 返回官網',en:'← Back to website'}});
