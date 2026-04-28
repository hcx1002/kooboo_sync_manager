# Kooboo Sync Manager

Kooboo Sync Manager 是基于 Kooboo Sync 开发的 Electron 桌面同步工具。它用于把 Kooboo 站点代码与站点设置同步到本地目录，便于 Git 管理、协作开发和人工校验。

## 效果图

![Kooboo Sync Manager Windows Preview](images/win.png)

## 功能概览

- 代码模块同步：`Page`、`View`、`Layout`、`Api`、`Code`、`Style`、`Script`、`Label`
- 站点数据同步：当前支持 `Settings`
- 多环境支持：`dev`、`acc`、`prod`
- 自动修复同步目录结构并补齐元数据文件
- 桌面端环境管理、实时日志和可视化操作

## 快速开始

### 1. 安装依赖

```bash
pnpm install
pnpm run build
```

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
- 图形化配置用户名、密码、API 地址、站点 ID、同步模块、自动上传、目标目录
- 一键执行拉取、强制拉取、推送、强制推送、修复目录、站点配置拉取、站点配置推送
- 实时日志面板显示信息、警告、错误
- 右侧操作面板可直接切换自动上传开关
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
  "SYNC_MODULES": "Page,View,Layout,Api,Code,Style,Script,Label",
  "FOLDER_NAME": "Kooboo",
  "AUTO_UPLOAD": false
}
```

注意：

- 桌面应用不依赖项目中的 `.env` 文件
- 密码当前以明文形式保存在本机配置文件中，建议使用权限受限的专用同步账号
- 站点 `Settings` 会同步到本地 `Site/config.json`
- 开启 `AUTO_UPLOAD` 后，会监听当前选中环境的站点目录变化并自动上传对应模块

## 项目结构

| 路径 | 说明 |
| --- | --- |
| `src/` | 同步核心逻辑与 API 封装 |
| `electron/` | Electron 主进程、预加载脚本和 Vue 界面 |
| `dist/` | TypeScript 编译产物 |
| `dist-electron/` | Electron 前端构建产物 |
| `release/` | 桌面应用打包输出 |

## 开发命令

```bash
pnpm run build
pnpm run electron:dev
pnpm run electron:clean
pnpm run electron:build
```

建议在执行同步前先提交或暂存本地改动，避免强制操作覆盖未保存的内容。

## 许可证

MIT
