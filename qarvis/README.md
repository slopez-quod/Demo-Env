# Q.A.R.V.I.S. mode for Claude Code

Makes Claude Code look and talk like Tony Stark's AI.

| Piece | File | Effect |
|---|---|---|
| Persona | `.claude/output-styles/qarvis.md` | Composed, dry-witted butler voice; HUD-style status lines (`▸ SCAN / ACTION / RESULT`) |
| HUD | `.claude/statusline/qarvis-hud.sh` | Two-line status bar: pulsing arc reactor, model, project@branch, context "power cell", cost, lines changed, greeting |
| Settings | `qarvis/settings.qarvis.json` | Activates the above, plus Stark spinner verbs, tips and startup greetings |

## Turn it on
1. Merge the keys from `qarvis/settings.qarvis.json` into `.claude/settings.json`
   (keep the existing `extraKnownMarketplaces` / `enabledPlugins` entries), or into
   `~/.claude/settings.json` to have Q.A.R.V.I.S. everywhere.
2. Make sure `jq` is installed (`brew install jq`) — the HUD needs it.
3. Run `claude` in this folder from a terminal.

Persona only, any time: `/output-style` → **QARVIS**. Turn off: pick **Default**.

## Finishing the look (terminal app, not Claude Code)
For the full HUD effect set your terminal (iTerm2 / Warp / Ghostty) to a near-black
navy background (`#05080f`), cyan foreground (`#00d7ff`), and a monospace font such as
JetBrains Mono or Orbitron-style "Share Tech Mono".

> Note: these cosmetics apply to the Claude Code **terminal CLI** and IDE extensions.
> The Claude web/mobile app doesn't load project status lines or spinner settings.
