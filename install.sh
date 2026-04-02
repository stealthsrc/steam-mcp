#!/usr/bin/env bash
# steam-mcp installer
# Local:  bash install.sh
# Remote: curl -fsSL https://raw.githubusercontent.com/StealthyLabsHQ/steam-mcp/main/install.sh | bash

set -e

REPO="https://github.com/StealthyLabsHQ/steam-mcp"
REPO_RAW="https://raw.githubusercontent.com/StealthyLabsHQ/steam-mcp/main"
INSTALL_DIR="$HOME/.claude/servers/steam-mcp"
COMMANDS_DIR="$HOME/.claude/commands/steam"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}v${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err()  { echo -e "${RED}x${NC} $1"; exit 1; }

# Detect local mode (script run from inside the cloned repo)
if [ -f "package.json" ] && grep -q '"name": "steam-mcp"' package.json 2>/dev/null; then
    LOCAL=true
    LOCAL_DIR="$(pwd)"
else
    LOCAL=false
fi

echo ""
echo "Installing steam-mcp for Claude Code..."
$LOCAL && echo "(local mode)" || echo "(remote mode — cloning from GitHub)"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────────────────────
node --version &>/dev/null || err "Node.js 18+ is required. Install it from https://nodejs.org"
NODE_MAJ=$(node --version | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJ" -ge 18 ] || err "Node.js 18+ required (found $(node --version))"
ok "Node.js found: $(node --version)"

# ── 2. Clone or use local repo ────────────────────────────────────────────────
if $LOCAL; then
    INSTALL_DIR="$LOCAL_DIR"
    ok "Using local directory: $INSTALL_DIR"
else
    mkdir -p "$(dirname "$INSTALL_DIR")"
    if [ -d "$INSTALL_DIR/.git" ]; then
        warn "Already cloned at $INSTALL_DIR — pulling latest..."
        git -C "$INSTALL_DIR" pull --quiet
    else
        git clone --quiet "$REPO" "$INSTALL_DIR"
    fi
    ok "Repository ready at $INSTALL_DIR"
fi

# ── 3. Build ──────────────────────────────────────────────────────────────────
cd "$INSTALL_DIR"
echo "Installing npm dependencies..."
npm install --silent
npm run build --silent
ok "Build complete"

# ── 4. Steam API key (visible input) ─────────────────────────────────────────
echo ""
echo "Enter your Steam API key (get one free at https://steamcommunity.com/dev/apikey):"
echo -n "> "
read -r STEAM_API_KEY < /dev/tty
echo ""

SKIP_REGISTER=false
if [ -z "$STEAM_API_KEY" ]; then
    warn "No key entered. You can register later with /steam:api YOUR_KEY in Claude Code."
    SKIP_REGISTER=true
fi

# ── 5. Register MCP server ────────────────────────────────────────────────────
if ! $SKIP_REGISTER; then
    NODE_PATH="$INSTALL_DIR/dist/index.js"
    if claude mcp add steam-mcp -e "STEAM_API_KEY=$STEAM_API_KEY" -- node "$NODE_PATH" 2>/dev/null; then
        ok "MCP server registered"
    else
        warn "Server already registered — updating..."
        claude mcp remove steam-mcp 2>/dev/null || true
        claude mcp add steam-mcp -e "STEAM_API_KEY=$STEAM_API_KEY" -- node "$NODE_PATH"
        ok "MCP server updated"
    fi
fi

# ── 6. Install slash commands ─────────────────────────────────────────────────
mkdir -p "$COMMANDS_DIR"
STEAM_CMDS=("achievements" "all" "api" "coop" "game" "library" "profile" "trend" "vac")

for CMD in "${STEAM_CMDS[@]}"; do
    if $LOCAL; then
        cp ".claude/commands/steam/$CMD.md" "$COMMANDS_DIR/$CMD.md"
    else
        if command -v curl &>/dev/null; then
            curl -fsSL "$REPO_RAW/.claude/commands/steam/$CMD.md" -o "$COMMANDS_DIR/$CMD.md"
        else
            wget -q "$REPO_RAW/.claude/commands/steam/$CMD.md" -O "$COMMANDS_DIR/$CMD.md"
        fi
    fi
    ok "Installed /steam:$CMD"
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}steam-mcp installed!${NC}"
echo ""
echo "  Restart Claude Code, then try:"
echo "  /steam:profile stealthylabs"
echo ""
