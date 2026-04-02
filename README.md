# steam-mcp

MCP server exposing Steam Web API tools to Claude Code and Gemini CLI.

---

## Prerequisites

- Node.js 18+
- A Steam Web API key → https://steamcommunity.com/dev/apikey

---

## Installation

```bash
git clone <repo>
cd steam-mcp
npm install
npm run build
```

---

## Add to Claude Code

### Option 1 - CLI (recommended)

```bash
claude mcp add steam-mcp -e STEAM_API_KEY=YOUR_KEY_HERE -- node C:/absolute/path/to/steam-mcp/dist/index.js
```

Verify it was added:

```bash
claude mcp list
claude mcp get steam-mcp
```

### Option 2 - Edit `.claude/mcp.json` manually

Open (or create) `.claude/mcp.json` in your project or home directory:

```json
{
  "mcpServers": {
    "steam-mcp": {
      "command": "node",
      "args": ["C:/absolute/path/to/steam-mcp/dist/index.js"],
      "env": {
        "STEAM_API_KEY": "YOUR_KEY_HERE"
      }
    }
  }
}
```

> Use an **absolute path** with forward slashes. The server is spawned by Claude Code as a child process - relative paths won't work.

### Option 3 - Claude Code Desktop (GUI)

1. Open Claude Code → **Settings** → **MCP Servers** → **Add server**
2. Fill in:
   - **Name**: `steam-mcp`
   - **Command**: `node`
   - **Args**: `C:/absolute/path/to/steam-mcp/dist/index.js`
   - **Env**: `STEAM_API_KEY=YOUR_KEY_HERE`
3. Save and restart Claude Code.

---

## Add to Gemini CLI

Edit `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "steam-mcp": {
      "command": "node",
      "args": ["C:/absolute/path/to/steam-mcp/dist/index.js"],
      "env": {
        "STEAM_API_KEY": "YOUR_KEY_HERE"
      }
    }
  }
}
```

---

## Slash Commands (Claude Code)

Slash commands are available after adding this project to Claude Code. They chain multiple MCP tools automatically and return formatted results with clickable Steam links.

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/steam:profile` | `<steamid\|vanity>` | Public profile + links to profile, friends, library |
| `/steam:game` | `<game name>` | Search by name - price, Metacritic, live player count |
| `/steam:trend` | `<game name>` | Health report - price, Metacritic, player count + verdict |
| `/steam:all` | `<steamid\|vanity>` | Full overview: profile + top games + recent activity + friends |
| `/steam:library` | `<steamid\|vanity>` | Deep library analysis: backlog %, total hours, gamer profile |
| `/steam:achievements` | `<steamid\|vanity> <game name>` | Achievement progress crossed with global rarity stats |
| `/steam:coop` | `<steamid1> <steamid2>` | Find games both players own - sorted by combined playtime |
| `/steam:vac` | `<steamid1> [steamid2] ...` | VAC/ban check for one or multiple players at once |

### Examples

```
/steam:profile stealthylabs
/steam:game Cyberpunk 2077
/steam:trend Rust
/steam:all 76561199832263296
/steam:library stealthylabs
/steam:achievements stealthylabs World of Tanks
/steam:coop stealthylabs gabelogannewell
/steam:vac 76561199832263296 76561197960287930
```

---

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `steam_resolve_vanity_url` | Convert a vanity URL (e.g. `gabelogannewell`) to a SteamID64 |
| `steam_get_player_summary` | Public profile: name, status, avatar, country, currently playing |
| `steam_get_friend_list` | Friend list with names and dates (`resolve_names` param) |
| `steam_get_player_bans` | VAC/game/community ban status for 1-100 accounts |
| `steam_get_owned_games` | Game library with playtime, sortable and filterable |
| `steam_get_recently_played` | Games played in the last 2 weeks |
| `steam_get_achievements` | Player achievement progress - filter by `locked/unlocked/all` |
| `steam_get_global_achievement_stats` | Global unlock rates (easiest/hardest achievements) |
| `steam_get_game_schema` | Full list of achievements and stats defined by a game |
| `steam_search_game` | Search by name - returns AppID, price, Metacritic score |
| `steam_get_current_players` | Number of players currently in-game for any app |

---

## Example prompts

```
Look up the Steam profile for "stealthylabs"

What are my 10 most played games? (SteamID: 76561198XXXXXXXXX)

Show me the global achievement stats for CS2

Which games have I bought but never launched?

Is Rust still worth buying in terms of player activity?
```

---

## Local test (without Claude Code)

```bash
# Test the server responds to MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | STEAM_API_KEY=YOUR_KEY node dist/index.js

# Or with .env file
npm start
# then pipe JSON manually or use MCP Inspector:
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Development

```bash
npm run dev      # hot reload via tsx
npm run build    # compile TypeScript → dist/
npm run lint     # tsc type-check only
npm test         # unit tests
```
