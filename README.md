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

The browser loads `rates.json` relative to Vite's base URL, so it works at a domain root and at the project Pages path. The comparison currency picker lists every currency in that file except JPY. If the file cannot load, the picker uses the last verified list in `src/currencies.ts`, and the calculator still shows the income-based equivalent. `rates:update` warns when the feed's currencies differ from that list. Tests use the dated fixtures in `tests/fixtures/` and never contact the ECB. Wiring the update into scheduled GitHub Pages builds remains separate work.

See the [product requirements](docs/_planning/v1.0-product-requirements-doc.md) and [design document](docs/_planning/v1.0-design-doc.md) for the full behavior and deployment requirements. Browser verification includes a 320 CSS-pixel viewport, keyboard access, appearance switching, and screen-reader announcements; unit tests do not replace those checks.

## Privacy and usage analytics

The calculator never sends or stores entered amounts, chosen currencies or presets, or results. Usage analytics through Google Analytics 4 is opt-in for every visitor: the site loads no Google code until the visitor selects **Allow analytics**, treats Global Privacy Control and Do Not Track as a decline, and lets visitors change their choice from **Analytics settings** in the footer. The [privacy notice](privacy.html) describes what is collected.

Analytics is off unless the build sets `VITE_GA_MEASUREMENT_ID`. Builds without it, including local builds, forks, and pull request checks, contain no analytics code. To enable analytics for the published site, add a `GA_MEASUREMENT_ID` repository variable (**Settings → Secrets and variables → Actions → Variables**) and set the production build step's `VITE_GA_MEASUREMENT_ID` environment variable from `vars.GA_MEASUREMENT_ID`. To try it locally, run `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run dev`.

Before enabling analytics, configure the GA4 property to match the privacy notice:

- In **Admin → Data collection and modification → Data collection**, turn off Google signals. Leave User-ID unused.
- In **Admin → Data collection and modification → Data retention**, set event data retention to 2 months.
- In the web data stream's enhanced measurement settings, turn off form interactions and site search.
- Don't link Google Ads or other Google products.
- In **Admin → Account settings**, accept the data processing terms.

If what analytics collects changes, increase `consentVersion` in `src/analytics.ts` so every visitor is asked again, and update the privacy notice and its date.

## Contributing

Read [AGENTS.md](AGENTS.md) for safety and contribution conventions. [CLAUDE.md](CLAUDE.md) imports those instructions, and [.claude/agents](.claude/agents/README.md) contains specialized agent guidance. Use the issue and pull request templates and report checks actually performed.

The AI configuration originated from [template-ai-agents](https://github.com/josh-wong/template-ai-agents). The MIT [license](LICENSE) applies.
