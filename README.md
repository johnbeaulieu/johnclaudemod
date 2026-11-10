# john-claude-mods

A Claude Code mod that puts git buttons above the prompt box, so common actions are one click away.

A button appears only when it has something to do:

| Repository state | Buttons shown |
|---|---|
| Uncommitted changes | **Commit (n) +a -r** (n changed files; a lines added in green, r removed in red, new files included), plus **Commit & push** if there's a remote |
| Nothing to commit, local commits not pushed (or branch never pushed) | **Push** |
| Nothing to commit, remote up to date | none |
| Not a git repository | none |

Each button sends a request to Claude (for example "Commit the current changes with a clear message"), so Claude writes the commit message and handles any errors. The mod re-checks git every 3 seconds and after each turn, so changes made in your own terminal show up quickly. "Remote up to date" compares against your last fetch; the mod does not fetch for you.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install john-claude-mods --marketplace johnbeaulieu/johnclaudemod
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```bash
claude plugin install john-claude-mods --marketplace johnbeaulieu/johnclaudemod
```

In the Claude desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `johnbeaulieu/johnclaudemod`, then **Add plugin**.

## Customize

Button labels and the text each one sends are constants at the top of [`hooks/register.tsx`](hooks/register.tsx).

## Develop

```bash
claude plugin validate .
claude plugin test .
```

## License

MIT
