# Japan Purchasing Power Calculator

Help visitors and residents understand what share of a monthly income in yen a purchase in Japan takes. The main result applies that share to a comparison income in another currency to show the equivalent cost. Exchange-rate conversion appears separately. The incomes can be real or hypothetical.

## Run locally

Use Node.js 24.15 or later in the 24.x line, or Node.js 26 or later and Python 3 for repository checks. Implementation was verified with Node.js 24.22.1 and npm 11.19.1.

```sh
npm ci
npm run rates:update
npm run dev
```

The `rates:update` step downloads the current ECB rates. Without it, the app still runs but shows "Exchange rate unavailable". Open the local URL printed by Vite. Financial inputs stay in memory for the visit. Browser storage holds only the appearance preference and, when analytics is configured, the visitor's analytics choice.

## Commands

Run these commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build `dist/` |
| `npm run preview` | Serve the built app locally |
| `npm run rates:update` | Fetch, validate, and write the ECB rate snapshot to `public/rates.json` |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm test` | Run parsing, calculation, rate-update, form-interaction, and analytics consent regression tests |
| `npm run lint` | Run ESLint, repository text checks, and reference mockup syntax checks |

The default build serves a domain root. For the project Pages path, run `npm run build -- --base=/japan-purchasing-power-calculator/`. Preview the built output at that path.

## Implementation and rate data

Page markup lives in `index.html` and `privacy.html`, styles in `src/styles.css`, the shared theme script in `public/theme.js`, and form state and rendering in `src/main.ts`. `src/calculator.ts` contains pure parsing and calculation functions. The original [mockup](docs/_planning/v1.0-gui-mockup.html) remains the interaction reference.

`scripts/update-rates.mjs` fetches the ECB daily XML feed and writes `public/rates.json`, which Vite serves from the app's own origin. The file holds the publication date, the source, and positive units-per-EUR rates, including EUR at 1. The command exits with an error, and keeps any existing file, when the fetch fails or the data is invalid (for example, a bad date or rate, or a missing JPY rate). `public/rates.json` is generated and ignored by Git.

The browser loads `rates.json` relative to Vite's base URL, so it works at a domain root and at the project Pages path. The comparison currency picker lists every currency in that file except JPY. If the file cannot load, the picker uses the last verified list in `src/currencies.ts`, and the calculator still shows the income-based equivalent. `rates:update` warns when the feed's currencies differ from that list. Tests use the dated fixtures in `tests/fixtures/` and never contact the ECB.

See the [product requirements](docs/_planning/v1.0-product-requirements-doc.md) and [design document](docs/_planning/v1.0-design-doc.md) for the full behavior and deployment requirements. Browser verification includes a 320 CSS-pixel viewport, keyboard access, appearance switching, and screen-reader announcements; unit tests do not replace those checks.

## Deployment

The calculator is published at `https://www.080f53.com/japan-purchasing-power-calculator/` through GitHub Pages, with **Settings → Pages → Source** set to **GitHub Actions**. `.github/workflows/pages.yaml` builds and deploys on pushes to `main`, daily at 17:20 Europe/Brussels (after the ECB's usual publication), and on manual dispatch. Pull requests run only the lint and build-and-test workflows, which never publish.

The build job runs lint, type-checking, and tests, then `npm run rates:update -- --fallback-url=<published rates.json>`, then builds with the `/japan-purchasing-power-calculator/` base, confirms `dist/rates.json` exists, and uploads `dist/`. The deploy job runs only if the build job succeeds, so a failed validation, test, or build leaves the previously published site and snapshot in place. If only the ECB fetch fails, the workflow reuses the snapshot already published at the site (validated the same way) so code changes can still ship, with a warning. A scheduled run that has to reuse it fails instead, so a missed refresh stays visible. The first deployment has nothing to reuse, so it needs a working ECB feed. Runs share one concurrency group, so they never overlap. GitHub keeps only one queued run, so a newer push can replace a queued scheduled run; the next daily run refreshes the snapshot.

Set the `GA_MEASUREMENT_ID` repository variable (**Settings → Secrets and variables → Actions → Variables**) to enable analytics in the production build. Without it, the build succeeds with a warning and the site has no analytics.

To recover from a failed run, read the log in **Actions**, fix the cause (for example, an ECB outage resolves itself on the next run), and choose **Run workflow**. GitHub disables scheduled workflows after 60 days without repository activity. If that happens, open **Actions → Deploy to GitHub Pages**, choose **Enable workflow**, and then **Run workflow** to refresh the snapshot.

## Contributing

Read [AGENTS.md](AGENTS.md) for safety and contribution conventions. [CLAUDE.md](CLAUDE.md) imports those instructions, and [.claude/agents](.claude/agents/README.md) contains specialized agent guidance. Use the issue and pull request templates and report checks actually performed.

The AI configuration originated from [template-ai-agents](https://github.com/josh-wong/template-ai-agents). The MIT [license](LICENSE) applies.
