# Japan Purchasing Power Calculator

Compare a purchase in Japan against monthly take-home pay in Japan and another currency. The main result applies the purchase's share of Japanese income to the comparison income. Exchange-rate conversion appears separately.

## Run locally

Use Node.js 24.15 or later in the 24.x line, or Node.js 26 or later and Python 3 for repository checks. Implementation was verified with Node.js 24.22.1 and npm 11.19.1.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Financial inputs stay in memory for the visit; only the appearance preference is stored.

## Commands

Run these commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build `dist/` |
| `npm run preview` | Serve the built app locally |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm test` | Run parsing, calculation, and form-interaction regression tests |
| `npm run lint` | Run ESLint, repository text checks, and reference mockup syntax checks |

The default build serves a domain root. For the project Pages path, run `npm run build -- --base=/japan-purchasing-power-calculator/`. Preview the built output at that path.

## Implementation and rate data

Page markup lives in `index.html`, styles in `src/styles.css`, and form state and rendering in `src/main.ts`. `src/calculator.ts` contains pure parsing and calculation functions. The original [mockup](docs/_planning/v1.0-gui-mockup.html) remains the interaction reference.

This migration injects the mockup's fixed November 11, 2026 rate fixture from `src/rates.ts`. It makes no live rate requests. The displayed date and outdated indicator apply to this fixture; these are illustrative estimates before exchange fees. Direct ECB ingestion, the complete supported currency list, and scheduled GitHub Pages publication remain separate work. Do not publish this fixture as a current rate feed.

See the [product requirements](docs/_planning/v1.0-product-requirements-doc.md) and [design document](docs/_planning/v1.0-design-doc.md) for the full behavior and deployment requirements. Browser verification includes a 320 CSS-pixel viewport, keyboard access, appearance switching, and screen-reader announcements; unit tests do not replace those checks.

## Contributing

Read [AGENTS.md](AGENTS.md) for safety and contribution conventions. [CLAUDE.md](CLAUDE.md) imports those instructions, and [.claude/agents](.claude/agents/README.md) contains specialized agent guidance. Use the issue and pull request templates and report checks actually performed.

The AI configuration originated from [template-ai-agents](https://github.com/josh-wong/template-ai-agents). The MIT [license](LICENSE) applies.
