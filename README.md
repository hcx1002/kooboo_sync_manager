# Kooboo Sync Manager

Kooboo Sync Manager 是基于 Kooboo Sync 开发出的 Kooboo 项目同步管理工具，支持命令行和 Electron 桌面应用两种使用方式。它用于把 Kooboo 站点代码与站点设置同步到本地目录，便于 Git 管理、协作开发和人工校验。

## 效果图

![Kooboo Sync Manager Windows Preview](images/win.png)

## 功能概览

- 代码模块同步：`Page`、`View`、`Layout`、`Api`、`Code`、`Style`、`Script`
- 站点数据同步：当前支持 `Settings`
- 多环境支持：`dev`、`acc`、`prod`
- 自动修复同步目录结构并补齐元数据文件
- 桌面端环境管理、实时日志和可视化操作

## Kooboo Sync 与 Kooboo Sync Manager

| 方式 | 适合场景 | 配置来源 |
| --- | --- | --- |
| Kooboo Sync CLI | 开发、脚本化、CI/CD | 优先用户数据目录配置，其次 `.env.{env}`，最后 `.env` |
| Kooboo Sync Manager | 日常手工同步、非命令行用户 | 用户数据目录 `environments/*.json` |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
pnpm run build
```

### 2. 初始化 CLI 配置

手动生成默认配置：

```bash
node dist/init-command.js init
```

通过 URL 自动解析并写入账号与站点信息：

```bash
node dist/init-command.js init https://username:password@sitename.domain.com
```

`init` 会生成默认 `.env` 模板，并在需要时补充 `.gitignore` 和脚本命令。

### 3. 常用 CLI 命令

```bash
node dist/index.js pull dev
node dist/index.js pull acc -f
node dist/index.js push prod
node dist/index.js fix dev
node dist/index.js site-pull dev
node dist/index.js site-push acc
```

说明：

- 默认环境是 `dev`
- `-f` 或 `--force` 表示强制拉取或强制推送
- `site-pull` 和 `site-push` 当前实际同步的是站点 `Settings`

如果你是通过 npm 包安装到其他项目，等价命令分别是：

- `kooboo-init`
- `kooboo-fix`
- `kooboo-pull`
- `kooboo-push`
- `kooboo-site-pull`
- `kooboo-site-push`

## CLI 配置

### 环境文件

- `dev` 对应 `.env.dev`
- `acc` 对应 `.env.acc`
- `prod` 对应 `.env.prod`
- 如果指定环境文件不存在，则回退到根目录 `.env`

### 配置示例

```env
# Kooboo Account
BASIC_AUTH_USER_NAME=your_username
BASIC_AUTH_PASSWORD=your_password

# Kooboo Site
API_BASE_URL=https://your-server.kooboo.io
SITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Sync Module
SYNC_MODULES=Page,View,Layout,Api,Code,Style,Script

# Relative to project root, or use an absolute path
FOLDER_NAME=Kooboo
```

字段说明：

- `SYNC_MODULES` 使用英文逗号分隔
- `FOLDER_NAME` 支持相对路径和绝对路径
- 相对路径会基于当前项目根目录解析

### 配置加载优先级

运行时的配置读取顺序如下：

1. 桌面应用运行时注入的配置
2. 用户数据目录中的 `{env}.json`
3. 项目根目录的 `.env.{env}`
4. 项目根目录的 `.env`

这意味着如果桌面应用已经为同名环境保存过配置，CLI 也会优先读取那份配置。

## 桌面应用

### 开发模式运行

```bash
pnpm run electron:dev
```

### 打包 Windows 安装程序

```bash
pnpm run electron:build
```

也可以使用：

```bash
pnpm run electron:build:win
```

### 打包 macOS 应用

```bash
pnpm run electron:build:mac
```

常用变体：

```bash
pnpm run electron:build:mac:x64
pnpm run electron:build:mac:arm64
pnpm run electron:build:mac:universal
pnpm run electron:build:mac:unsigned
```

说明：

- `electron:build:mac:unsigned` 会关闭证书自动发现，用于先生成未签名安装包
- 真正对外分发时，仍建议使用 Apple Developer ID 签名并做 notarization
- macOS 打包应在 macOS 机器上执行，不要指望在 Windows 上直接产出可用的 macOS 发布包

仓库中还提供了 Windows 辅助脚本：

```powershell
./setup-desktop-app.ps1
```

### 桌面端提供的能力

- 环境列表管理，支持新增、编辑、删除环境
- 图形化配置用户名、密码、API 地址、站点 ID、同步模块、目标目录
- 一键执行拉取、强制拉取、推送、强制推送、修复目录
- 实时日志面板显示信息、警告、错误
- 图形化选择目标文件夹

### 桌面端配置存储位置

- Windows：`%APPDATA%\kooboo-sync\environments\*.json`
- macOS：`~/Library/Application Support/kooboo-sync/environments/*.json`
- Linux：`~/.config/kooboo-sync/environments/*.json`

### 桌面端配置示例

```json
{
  "LABEL": "开发环境",
  "BASIC_AUTH_USER_NAME": "your-username",
  "BASIC_AUTH_PASSWORD": "your-password",
  "API_BASE_URL": "https://your-server.kooboo.io",
  "SITE_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "SYNC_MODULES": "Page,View,Layout,Api,Code,Style,Script",
  "FOLDER_NAME": "Kooboo"
}
```

注意：

- 桌面应用不依赖项目中的 `.env` 文件
- 密码当前以明文形式保存在本机配置文件中，建议使用权限受限的专用同步账号

## 项目结构

| 路径 | 说明 |
| --- | --- |
| `src/` | CLI 命令入口与同步核心逻辑 |
| `electron/` | Electron 主进程、预加载脚本和 Vue 界面 |
| `dist/` | TypeScript 编译产物 |
| `dist-electron/` | Electron 前端构建产物 |
| `release/` | 桌面应用打包输出 |

## 开发命令

```bash
pnpm run build
pnpm run electron:dev
pnpm run electron:clean
pnpm run pull:dev
pnpm run push:acc
pnpm run fix:prod
```

建议在执行同步前先提交或暂存本地改动，避免强制操作覆盖未保存的内容。

## 许可证

MIT
