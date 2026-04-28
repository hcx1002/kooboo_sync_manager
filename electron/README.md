# Kooboo Sync Desktop Application

## 🎯 功能特性

### ✅ **独立配置管理**
- 配置存储在应用数据目录，不依赖项目中的 `.env` 文件
- Windows: `C:\Users\{用户}\AppData\Roaming\kooboo-sync\environments\`
- macOS: `~/Library/Application Support/kooboo-sync/environments/`
- Linux: `~/.config/kooboo-sync/environments/`

### ✅ **多环境支持**
- 默认环境：dev（开发）、acc（验收）、prod（生产）
- 支持自定义环境：点击"添加自定义环境"按钮
- 支持复制、删除、拖动排序环境
- 每个环境独立配置，互不影响

### ✅ **可视化操作**
- 环境切换：点击左侧环境列表
- 配置编辑：通过环境操作菜单打开配置
- 同步操作：拉取、推送、修复目录、初始化开发配置、站点配置同步
- 自动上传：在右侧操作面板直接开关
- 实时日志：查看执行过程

## 🚀 使用方法

### 1. **启动应用**

开发模式（带热更新）：
```bash
pnpm run electron:dev
```

打包生产版本：
```bash
pnpm run electron:build
```

### 2. **配置环境**

1. 选择或创建环境（dev/acc/prod 或自定义）
2. 填写配置信息：
   - **用户名**：Kooboo 账号用户名
   - **密码**：Kooboo 账号密码
   - **API地址**：Kooboo 服务器地址（如：`https://server.kooboo.io`）
   - **站点ID**：要同步的站点 ID（UUID 格式）
   - **同步模块**：要同步的模块列表（逗号分隔）
   - **自动上传**：监听站点目录变化并自动上传对应模块
   - **目标文件夹**：本地同步目录路径
3. 点击"💾 保存配置"

### 3. **执行同步**

- **⬇️ 拉取 (Pull)**：从服务器下载到本地
- **⬇️⚡ 强制拉取**：强制覆盖本地文件
- **⬆️ 推送 (Push)**：从本地上传到服务器
- **⬆️⚡ 强制推送**：强制覆盖服务器文件
- **🔧 修复目录**：修复本地目录结构和模块 metadata
- **初始化开发配置**：在目标文件夹创建 AI 规则、类型提示和 UnoCSS 代码提示文件
- **⬇️ 站点配置拉取**：将站点 `Settings` 保存到本地 `Site/config.json`
- **⬆️ 站点配置推送**：将本地 `Site/config.json` 推送到站点 `Settings`

### 4. **关键功能说明**

#### 修复目录

`修复目录` 会根据当前环境的同步模块整理目标文件夹：

- 创建缺失的目标目录和模块目录
- 创建或更新模块下的 `__metadata.json`
- 删除 metadata 中已经没有本地文件的记录
- 把未登记到 metadata 的本地文件补入记录，新记录使用空 GUID，后续推送时创建远端项目
- 对新增的 `Api` 文件补默认 `url`，对新增的 `Page` 文件补默认 `path`
- 对 `Label` 模块创建或规范化本地标签文件

这个功能适合在手动新增、删除、重命名本地模块文件后使用。

#### 初始化开发配置

`初始化开发配置` 会在当前环境的目标文件夹中创建以下开发辅助文件，已存在的文件会跳过，不会覆盖：

- `AGENTS.md`：给 AI 编码助手看的项目规则
- `kooboo.project.d.ts`：Kooboo 项目类型入口
- `types.kooboo.d.ts`：Kooboo 运行时 API 类型提示
- `tsconfig.json`：编辑器 TypeScript 配置
- `uno.config.ts`：本地 UnoCSS 代码提示配置

#### 站点配置和 UnoCSS

- 拉取站点配置会写入 `Site/config.json`
- 推送站点配置会读取本地 `Site/config.json`
- Kooboo 站点的权威 UnoCSS 配置在 `Site/config.json` 的 `unocssSettings.config`
- 本地 `uno.config.ts` 用于编辑器代码提示，会在拉取或推送站点配置时自动刷新

### 5. **查看日志**

右侧日志面板实时显示执行过程和结果。

## 📁 配置文件格式

每个环境的配置保存为 JSON 文件：

```json
{
  "BASIC_AUTH_USER_NAME": "your-username",
  "BASIC_AUTH_PASSWORD": "your-password",
  "API_BASE_URL": "https://your-server.kooboo.io",
  "SITE_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "SYNC_MODULES": "Page,View,Layout,Api,Code,Style,Script,Label",
  "FOLDER_NAME": "Kooboo",
  "AUTO_UPLOAD": false
}
```

## 🔒 安全性

- 配置文件存储在用户专属的应用数据目录
- 使用 Electron contextBridge 隔离渲染进程
- 密码明文存储在本地（建议使用专用账号）

## 🎨 界面预览

- **左侧边栏**：环境选择 + 配置表单
- **右上区域**：同步操作按钮
- **右下区域**：实时日志显示

## 💡 高级用法

### 添加自定义环境

1. 点击"➕ 添加自定义环境"按钮
2. 输入环境名称（如：`test`, `staging`）
3. 输入显示名称（如：`测试环境`, `预发布环境`）
4. 配置该环境的参数并保存

### 删除环境配置

在环境列表的操作菜单中删除环境配置。

## 🛠️ 技术栈

- **Electron 28**: 桌面应用框架
- **Vue 3**: UI 框架
- **Vite 5**: 构建工具
- **Node.js**: 后端逻辑
- **TypeScript**: 同步核心逻辑

## 🔄 与项目集成

桌面应用**不依赖**项目中的 `.env` 文件，所有配置独立管理。
