# Kooboo Sync 桌面应用安装和运行脚本

Write-Host "🚀 Kooboo Sync 桌面应用 - 安装向导" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查Node.js
Write-Host "📋 检查环境..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未安装Node.js，请先安装Node.js" -ForegroundColor Red
    exit 1
}

if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未安装pnpm，正在安装..." -ForegroundColor Yellow
    npm install -g pnpm
}

Write-Host "✅ 环境检查完成" -ForegroundColor Green
Write-Host ""

# 安装依赖
Write-Host "📦 安装依赖..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 依赖安装失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 依赖安装完成" -ForegroundColor Green
Write-Host ""

# 构建TypeScript
Write-Host "🔨 构建TypeScript代码..." -ForegroundColor Yellow
pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 构建完成" -ForegroundColor Green
Write-Host ""

# 询问用户要做什么
Write-Host "请选择操作:" -ForegroundColor Cyan
Write-Host "1. 启动开发模式（推荐，可以热更新）" -ForegroundColor White
Write-Host "2. 打包成Windows可执行程序" -ForegroundColor White
Write-Host "3. 仅启动应用（不使用Vite）" -ForegroundColor White
Write-Host ""

$choice = Read-Host "请输入选项 (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🚀 启动开发模式..." -ForegroundColor Green
        Write-Host "应用将在新窗口打开，请稍候..." -ForegroundColor Yellow
        pnpm run electron:dev
    }
    "2" {
        Write-Host ""
        Write-Host "📦 开始打包..." -ForegroundColor Green
        Write-Host "这可能需要几分钟时间..." -ForegroundColor Yellow
        pnpm run electron:build
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ 打包完成！" -ForegroundColor Green
            Write-Host "可执行文件位于: .\release\" -ForegroundColor Cyan
            
            # 询问是否打开文件夹
            $openFolder = Read-Host "是否打开文件夹？(Y/N)"
            if ($openFolder -eq "Y" -or $openFolder -eq "y") {
                explorer ".\release\"
            }
        } else {
            Write-Host "❌ 打包失败" -ForegroundColor Red
        }
    }
    "3" {
        Write-Host ""
        Write-Host "🚀 启动应用..." -ForegroundColor Green
        pnpm run app:dev
    }
    default {
        Write-Host "❌ 无效选项" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
