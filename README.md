# LucidRank 桌面版（Windows 原型 v0.1）

给 VALORANT / CS2 玩家的小工具：开打前花 10 秒点 8 下，记一下昨晚几点睡、睡了多久、醒来刷了多久手机、运动、吃饭、咖啡因和心情；打完记一笔战绩。攒够一段时间后，它会拿**你自己的**数据对比，告诉你哪个习惯最影响你的发挥，每周给一个从你现状出发的小目标。

> 这是第一个能跑的原型。界面、功能和数据格式之后都可能变。

![今天](shots/sc-08-today-done.png)

## 能做什么

| 功能 | 说明 |
| --- | --- |
| 托盘常驻 | 关掉主窗口后它待在系统托盘。托盘菜单：打开 / 现在签到 / 道具点位 / 退出。开机自启默认**关闭**，在设置里开。 |
| 游戏检测 | 每 5 秒看一次进程列表里有没有 `VALORANT-Win64-Shipping.exe` 或 `cs2.exe`。游戏启动且今天还没签到时，弹一个居中的签到小窗（聚焦一次）并发一条 Windows 通知。**每天最多弹一次**；小窗里有「今天不了」。 |
| 每日签到 | 和官网演示同一套题：入睡时间、睡眠时长、醒后床上刷手机、运动（练了会追问离开打多久）、三餐、开打前 2 小时吃了什么（可多选）、咖啡因、心情。点击或键盘 1–5，约 10 秒，点完自动关闭。 |
| 战绩记录 | 输 / 赢 / 平，K/D/A，ACS（VALORANT）或 ADR（CS2），地图和段位可选；可以附一张结算截图（只存文件路径，**自动识别 OCR 即将推出**，v0.1 不做）。 |
| 洞察 | 有签到又有对局的日子满 8 天后，按 睡不到 6 小时 vs 睡够 7 小时、1 点前 vs 1 点后睡、醒后刷手机超 30 分钟 vs 没超、运动 vs 没运动、咖啡因 2 杯以上 vs 以内，对比胜率和平均 ACS/ADR。数据不够时显示「还需要 N 天」。有「载入示例数据」按钮可以先看效果。 |
| 每周目标 | 纯规则，不用 AI。找出差距最大的 1–2 个习惯，列出你自己的数据作为依据，只给**一个**小目标，并且从你现在的水平往前挪一档（平时 2 点后睡的人，目标是「3 天在 2 点前睡」，而不是「11 点睡」）。显示本周进度 x/3（或 x/5）和上周结果。只谈作息和生活习惯，不涉及医疗、药物或补剂。 |
| 道具点位 | 单独窗口。选地图 / 英雄（CS2 为道具类型）/ 攻防 / 场景，看卡片列表、抽象小地图（站位、瞄点、投掷路线、落点）和三步说明，可收藏、标记「学会了」。检测到游戏时标题栏会显示。地图无法自动识别（我们不读游戏数据），所以由你来选，下次会记住。**全部为示例数据**，不是真实可用的 lineup，也没有使用任何 Riot / Valve 素材。 |
| 应用内更新 | 从 v0.1.2 起：打开时和之后每 6 小时悄悄检查一次有没有新版本，有的话右下角出一个小卡片「有新版本 v0.1.x」+ 简短说明，点「现在更新」才下载（显示进度），装好后自动重启；点「稍后」6 小时内不再提醒。设置 → 更新 里能看到当前版本、手动「检查更新」、关掉「自动检查更新」。安装包有签名校验（minisign），校验不过不会安装。 |
| 设置 | 语言（跟随系统 / 简体 / 繁體 / English）、开机自启、检测哪些游戏、更新、导出 JSON、删除全部数据。 |

## 更新记录

- **v0.1.2**：应用内更新（见上表）。检查地址依次是 `https://lucidrank.pages.dev/update/latest.json` 和 GitHub Releases 的 `latest.json`，一个连不上就用另一个；下载太慢或卡住也会自动换另一条线路。新标语「先清醒，再上分。」。Release 改为正式版本（不再是预发布），这样 GitHub 的 `releases/latest` 能找到它。**v0.1.1 及更早的版本没有更新功能，需要手动装一次 v0.1.2**，之后就能在应用里更新了。
- **v0.1.1**：所有窗口改用深色自绘标题栏（Win11 风格的最小化 / 最大化 / 关闭，关闭键悬停变红，双击标题栏最大化，保留圆角和系统阴影，可拖动边缘调整大小）；鼠标点击不再出现焦点框（只有键盘 Tab 时才显示）；边框整体减淡。修复 Windows 上「开始签到」弹窗白屏、无法关闭，以及「道具点位」窗口打不开的问题（窗口改为在后台线程创建，避免 WebView2 死锁）；如果弹窗仍然打不开，会自动在主窗口里完成签到 / 显示道具点位。签到小窗重新设计：顶部显示游戏状态和「今天不用了」，进度条，更大的选项，完成后 3 秒自动关闭。
- **v0.1.0**：第一个原型。

## 安全说明（反作弊）

LucidRank **只**通过系统的进程列表（`sysinfo`，只读进程名）判断 VALORANT / CS2 是否在运行。它：

- 不读写游戏内存，不打开游戏进程句柄；
- 不注入、不 hook 任何东西；
- 不在游戏上画覆盖层（overlay）；
- 不截屏、不录屏；
- 不模拟键盘鼠标输入。

它就是一个普通的独立窗口，像手机上的攻略一样，需要时 Alt+Tab 切出来看。和 Vanguard、Tencent ACE、VAC 都没有交集。

## 安装

1. 到 [Releases](../../releases) 下载最新的 `LucidRank_<版本>_x64-setup.exe`（例如 `LucidRank_0.1.2_x64-setup.exe`，也有 `.msi`），或者从 [官网](https://lucidrank.pages.dev/#download) 下载。直接覆盖安装旧版本即可，数据会保留。装了 v0.1.2 之后，新版本可以直接在应用里更新。
2. 安装包**没有代码签名**，Windows SmartScreen 会拦一下：点「**更多信息**」→「**仍要运行**」。
3. 默认装在当前用户目录，不需要管理员权限。需要 WebView2（Win10/11 一般自带，没有的话安装程序会自动下载）。

## 数据存在哪

全部只在本机，没有账号，不上传任何东西。唯一的联网是检查更新：下载一个很小的 `latest.json`（可以在设置里关掉），确认更新后才会下载安装包。

- 数据文件：`%APPDATA%\hk.lucidrank.desktop\lucidrank-data.json`
- 弹窗状态（今天有没有弹过 / 「今天不了」）：同目录下 `prompt-state.json`
- 设置 → 数据 里能看到完整路径、导出 JSON、或一键删除。
- 「一天」以早上 5 点为界，凌晨 1 点打的那局仍算前一天晚上。

卸载程序不会自动删除数据文件，想清干净可以先在设置里点「删除全部数据」。

## 开发

技术栈：Tauri v2（Rust）+ 纯 HTML/CSS/JS，没有前端框架。

```bash
npm ci
npm run tauri dev          # 开发运行
npm run tauri build        # 打包（Windows 上生成 NSIS .exe 和 .msi）
```

- 前端在 `src/`：`index.html`（主窗口）、`checkin.html`（签到小窗）、`lineups.html`（道具点位），文案在 `src/js/i18n.js`（sc / tc / en）。签到题目从概念网站复制而来。
- Rust 在 `src-tauri/src/lib.rs`：托盘、窗口、进程检测、本地 JSON 读写、通知、开机自启。
- 在普通浏览器里直接打开 `src/` 也能用（自带 Tauri API 的 localStorage 模拟），方便改界面：`cd src && python3 -m http.server 8765`，然后 `python3 tools/shots.py full` 生成 `shots/` 截图；`node tools/test_stats.js` 检查洞察和目标的规则。
- GitHub Actions（`.github/workflows/build-windows.yml`）在 `windows-latest` 上用 tauri-action 打包，上传为构建产物，并按 `tauri.conf.json` 里的版本号发布正式 Release（`v0.1.2` 等，每个版本一个）。Release 里还有更新用的 `.sig` 签名和 `latest.json`（说明文字取自 `src-tauri/update-notes.txt`，每种语言一行 `sc:` / `tc:` / `en:`）。
- 更新签名：私钥和密码在仓库 Secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，公钥在 `tauri.conf.json` → `plugins.updater.pubkey`。私钥不进仓库；丢了私钥就没法给已安装的版本推更新。
- 发新版本：改 `tauri.conf.json`、`Cargo.toml`、`package.json` 里的版本号和 `src-tauri/update-notes.txt`，推到 main。CI 发完 Release 后，把 NSIS 安装包、`.sig` 和改好 `url` 的 `latest.json` 放到官网的 `/update/`（Cloudflare 那条线路）。
- 更新逻辑在 `src-tauri/src/updater.rs`（Rust）和 `src/js/updater.js`（界面）。只在 debug 构建里有两个测试开关：`LR_UPDATE_ENDPOINT=url[,url]` 换检查地址，`LR_UPDATE_DRYRUN=1` 下载并校验签名后不安装。release 构建没有这两个开关，也只接受 https。

## 已知限制（v0.1）

- 截图只保存路径，不识别内容（OCR 之后再做）。
- 洞察是简单的分组对比，样本少时波动很大，只能当参考，不是科学结论。
- 道具点位全部是示例数据和抽象示意图。
- 安装包没有代码签名，SmartScreen 会提示（应用内更新用的是另一套 minisign 签名，不影响 SmartScreen）。
- 应用内更新的检查、换线路、下载进度和签名校验在 Linux 测试版上验证过；Windows 上真正「从 v0.1.2 更新到下一个版本」（被动安装 + 自动重启）要等 v0.1.3 发布后才能完整验证。
