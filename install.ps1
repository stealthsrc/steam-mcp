# steam-mcp installer for Windows
# Local:  .\install.ps1
# Remote: irm https://raw.githubusercontent.com/stealthsrc/steam-mcp/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo        = "https://github.com/stealthsrc/steam-mcp"
$RepoRaw     = "https://raw.githubusercontent.com/stealthsrc/steam-mcp/main"
$InstallDir  = "$env:USERPROFILE\.claude\servers\steam-mcp"
$CommandsDir = "$env:USERPROFILE\.claude\commands\steam"

function Ok   { param($msg) Write-Host "v $msg" -ForegroundColor Green }
function Warn { param($msg) Write-Host "! $msg" -ForegroundColor Yellow }
function Err  { param($msg) Write-Host "x $msg" -ForegroundColor Red; exit 1 }

# Detect local mode (script run from inside the cloned repo)
$Local = (Test-Path "package.json") -and ((Get-Content "package.json" -Raw) -match '"name":\s*"steam-mcp"')

Write-Host ""
Write-Host "Installing steam-mcp for Claude Code..." -ForegroundColor Cyan
if ($Local) { Write-Host "(local mode)" } else { Write-Host "(remote mode — cloning from GitHub)" }
Write-Host ""

# ── 1. Check Node.js ──────────────────────────────────────────────────────────
try {
    $nodeVer = node --version 2>&1
    $nodeMaj = [int]($nodeVer -replace 'v(\d+)\..*', '$1')
    if ($nodeMaj -lt 18) { Err "Node.js 18+ required (found $nodeVer)" }
    Ok "Node.js found: $nodeVer"
} catch {
    Err "Node.js 18+ is required. Install it from https://nodejs.org"
}

# ── 2. Clone or use local repo ────────────────────────────────────────────────
if ($Local) {
    $InstallDir = (Get-Location).Path
    Ok "Using local directory: $InstallDir"
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir) | Out-Null
    if (Test-Path "$InstallDir\.git") {
        Warn "Already cloned at $InstallDir — pulling latest..."
        git -C $InstallDir pull --quiet
    } else {
        git clone --quiet $Repo $InstallDir
    }
    Ok "Repository ready at $InstallDir"
}

# ── 3. Build ──────────────────────────────────────────────────────────────────
Set-Location $InstallDir
Write-Host "Installing npm dependencies..."
npm install --silent
npm run build --silent
Ok "Build complete"

# ── 4. Steam API key (visible input) ─────────────────────────────────────────
Write-Host ""
Write-Host "Enter your Steam API key (get one free at https://steamcommunity.com/dev/apikey):"
Write-Host -NoNewline "> "
$SteamApiKey = Read-Host

$SkipRegister = $false
if (-not $SteamApiKey) {
    Warn "No key entered. You can register later with /steam:api YOUR_KEY in Claude Code."
    $SkipRegister = $true
}

# ── 5. Register MCP server ────────────────────────────────────────────────────
if (-not $SkipRegister) {
    $NodePath = "$InstallDir\dist\index.js"
    try {
        claude mcp add steam-mcp -e "STEAM_API_KEY=$SteamApiKey" -- node $NodePath 2>&1 | Out-Null
        Ok "MCP server registered"
    } catch {
        Warn "Server already registered — updating..."
        claude mcp remove steam-mcp 2>&1 | Out-Null
        claude mcp add steam-mcp -e "STEAM_API_KEY=$SteamApiKey" -- node $NodePath
        Ok "MCP server updated"
    }
}

# ── 6. Install slash commands ─────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $CommandsDir | Out-Null
$SteamCmds = @("achievements", "all", "api", "coop", "game", "library", "profile", "trend", "vac")

foreach ($Cmd in $SteamCmds) {
    if ($Local) {
        Copy-Item ".claude\commands\steam\$Cmd.md" "$CommandsDir\$Cmd.md" -Force
    } else {
        Invoke-WebRequest "$RepoRaw/.claude/commands/steam/$Cmd.md" -OutFile "$CommandsDir\$Cmd.md" -UseBasicParsing
    }
    Ok "Installed /steam:$Cmd"
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "v steam-mcp installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Restart Claude Code, then try:" -ForegroundColor Cyan
Write-Host "  /steam:profile stealthylabs"
Write-Host ""
