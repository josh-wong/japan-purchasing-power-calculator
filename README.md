# Japan Purchasing Power Calculator

Compare what a purchase in Japan costs relative to monthly take-home pay in Japan and another currency. The main result is the equivalent cost based on income; the exchange-rate conversion is shown separately.

## Project status

This repository contains the v1.0 planning documents and an interactive mockup. The production HTML, CSS, TypeScript, and Vite app and its GitHub Pages deployment have not been implemented.

- [Product requirements](docs/_planning/v1.0-product-requirements-doc.md)
- [Design document](docs/_planning/v1.0-design-doc.md)
- [Interactive mockup](docs/_planning/v1.0-gui-mockup.html) — open this file in a browser. It requests ECB rates through Frankfurter and falls back to a bundled dated snapshot.

The planned app keeps financial inputs in browser memory and serves ECB rate snapshots refreshed by GitHub Actions. Only the appearance preference is persisted.

## Validation

With Python 3 and Node.js installed, run these checks from the repository root:

```sh
python3 scripts/check_repository.py lint
python3 scripts/check_repository.py mockup
```

These validate template resolution, local Markdown file links, final newlines, and inline JavaScript syntax. They do not verify browser behavior or calculations. There is no production build or automated application test suite yet; see the design document for the browser verification scenarios.

## Contributing

Read [AGENTS.md](AGENTS.md) for architecture constraints and contribution conventions. [CLAUDE.md](CLAUDE.md) imports the same instructions for Claude Code; specialized agents live in [.claude/agents](.claude/agents/README.md). Use the GitHub issue and pull request templates and report which checks were actually run.

The AI configuration originated from [template-ai-agents](https://github.com/josh-wong/template-ai-agents), adapted from revision `6ddccf6924b12dde3da8bc43cb3d60f3015dc6cc`. The MIT [license](LICENSE) applies.
