# LucidRank Windows v0.1.7

记录身体状态、个人计划与 VALORANT / CS2 对局，查看个人数据中的关联，并收藏、练习点位教学。

## 本版功能

- 与网页版同步的界面、Logo、字体和简中 / 繁中 / English。
- 三步健康记录：睡眠、身体感受、饮食、咖啡因、计划执行。未知项可以留空。
- 对局支持战斗表现评分、独立历史 ACS、K/D、击杀差、详细统计、角色与比赛条件。
- 完整特工选择、点位原作者视频与教学、个人点位库和训练记录。
- 账号云端同步、截图备份、恢复码找回账号。邮件找回尚未配置。
- 保留原有托盘、游戏进程名称检测、签到小窗、通知、自启开关和签名自动更新。

## 安装与数据

到 [官网](https://lucidrank.pages.dev/#download) 或 [Releases](https://github.com/EthanLai-9du/lucidrank-app/releases) 下载真实最新安装包，覆盖安装保留已有本机数据。

游客记录仍在 `%APPDATA%\hk.lucidrank.desktop\lucidrank-data.json`。登录后使用同目录的 `accounts/<账号ID>.json`；游客记录和账号记录相互独立。账号页面可上传登录前的游客记录，替换云端数据前会下载备份。

登录会话只存在软件内存中，完全退出软件后需要重新登录。本机账号记录不会删除。退出账号回到游客记录。请保存恢复码并定期导出完整备份。

点位教学会请求官网的已发布内容；登录后健康、对局、截图及个人点位记录存入自己的云端账号。普通用户无法获得开发者权限。

## 构建与发布

```sh
npm ci
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run tauri build
```

GitHub Actions 在 Windows 上测试、构建 NSIS / MSI，并用既有 Secrets `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 为更新产物签名。更新公钥不变，旧版可以继续验证新包。发布后必须同步官网安装包、签名、更新清单与 `releases/windows.json`，验证哈希后更新下载按钮。

安装包尚未使用 Windows Authenticode 签名；更新用的 minisign 签名是另一套验证。自动更新安装及重启需要在真实 Windows 上验证。

游戏检测只读取进程名称，不读取游戏内存、不注入、不覆盖游戏、不自动截图、不模拟输入。统计仅描述个人记录中的关联；样本、健康、角色、模式及版本差异仍会影响结果。
