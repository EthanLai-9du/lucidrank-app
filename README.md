# LucidRank 桌面版（未完成 / WIP）

> **还在做，不是成品。** 有的功能没接完，邮件找回尚未配置。
> **Work in progress. Not finished.** Some features are incomplete; email recovery is not set up.

Windows 桌面应用（Tauri）。每天签到，记下 VALORANT / CS2 对局，看自己记录里的关联，收藏并练习点位。当前版本 0.1.7。

概念站和网页版在另一个仓库：[lucidrank](https://github.com/EthanLai-9du/lucidrank)。线上：[lucidrank.pages.dev](https://lucidrank.pages.dev)。

## 这版有的

- 界面、Logo、字体与网页版对齐。简中 / 繁中 / English。
- 三步健康记录：睡眠、身体感受、饮食、咖啡因、计划执行。不知道的可以留空。
- 对局：战斗表现评分、独立历史 ACS、K/D、击杀差、详细统计、角色和比赛条件。
- 完整特工选择、点位原作者视频与教学、个人点位库、训练记录。
- 账号云端同步、截图备份、恢复码找回。
- 托盘、进程名检测、签到小窗、通知、开机自启、签名自动更新。

邮箱只用来登录。没有发信服务，不能用邮件重设密码。请保存恢复码，并定期导出完整备份。密码和恢复码都丢了，账号找不回来。

## 安装与数据

到 [官网](https://lucidrank.pages.dev/#download) 或 [Releases](https://github.com/EthanLai-9du/lucidrank-app/releases) 下载真实最新安装包。覆盖安装会留下已有本机数据。

游客记录在 `%APPDATA%\hk.lucidrank.desktop\lucidrank-data.json`。登录后是同目录的 `accounts/<账号ID>.json`。两份记录分开。账号页可以上传登录前的游客记录；替换云端数据前会先下载备份。

登录会话只在软件内存里。完全退出后再开，要重新登录。本机账号文件还在。退出账号回到游客记录。

点位教学会去官网拉已发布内容。登录后，健康、对局、截图和个人点位进你自己的云端账号。普通用户没有开发者权限。

## 构建与发布

```sh
npm ci
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run tauri build
```

GitHub Actions 在 Windows 上测试，打 NSIS / MSI，并用 Secrets `TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 给更新包签名。更新公钥不变，旧版可以继续验证新包。发出去之后，要一起改官网安装包、签名、更新清单和 `releases/windows.json`，对过哈希再换下载按钮。

安装包没有 Windows Authenticode 签名。应用内更新用的是另一套 minisign。自动更新的安装和重启，要在真实 Windows 上核对。

## 隐私

游戏检测只读进程名称，用来判断 VALORANT 或 CS2 是否在跑。不读游戏内存，不注入，不做覆盖层，不自动截图，不模拟输入。

统计只描述你自己记下的关联。样本、当天状态、角色、模式和版本都会影响结果。
