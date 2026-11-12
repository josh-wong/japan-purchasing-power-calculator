# AI assistant configuration

This file contains configuration and guidelines for AI assistants when working on this repository. It follows the [AGENTS.md](https://agents.md) convention and is read directly by GitHub Copilot; Claude Code reads it via the `@AGENTS.md` import in `CLAUDE.md`.

## Important notes

**GIT SAFETY:** NEVER force push to any branch. Force pushes can:

- Overwrite remote history and cause data loss.
- Accidentally commit files that should be in .gitignore.
- Invalidate pull requests and break collaboration.

Always use `git push` without `--force` or `--force-with-lease`. If you need to undo work, use `git revert` instead of `git push --force` or `git push --force-with-lease`.

## Documentation references

For detailed information about this project, refer to the following internal documentation.

- **Repository overview:** See `README.md` for a general project description.
- **Product or design docs:** [v1.0 product requirements](docs/_planning/v1.0-product-requirements-doc.md), [design document](docs/_planning/v1.0-design-doc.md), and [interactive mockup](docs/_planning/v1.0-gui-mockup.html).

## Repository overview

Japan Purchasing Power Calculator is an English-language web calculator for visitors and residents comparing purchases in Japan against monthly take-home pay in Japan and another currency. It leads with an income-based equivalent cost and shows exchange-rate conversion separately.

### Key components

The app uses HTML, CSS, TypeScript, and Vite, with pure parsing/calculations and in-memory form state. The standalone mockup remains the reference. The migration uses an injected dated rate fixture; production ECB ingestion and GitHub Pages publication are separate work.

### Architecture patterns

Keep income-based equivalence independent of exchange rates: `(priceJpy / japanMonthly) * comparisonMonthly`. Convert currency with `priceJpy * (target units per EUR / JPY per EUR)`. Round only for display, and preserve independently computable results when other inputs or rates are missing. Keep comparison incomes keyed by currency for the visit.

Production rates must be fetched and validated in CI from the ECB and served from the same origin; a failed refresh must stop publication. Show the source and publication date, flag snapshots older than seven calendar days, and resolve assets through Vite’s base URL for both root and project Pages paths. The mockup’s keyless Frankfurter request and bundled fallback are prototype behavior, not the production data pipeline.

## Development workflow

Follow these guidelines to maintain code quality and project consistency.

### Issue creation guidelines

When creating a GitHub issue, provide clear descriptions of bugs or feature requests including steps to reproduce, expected vs. actual behavior, environment details, and relevant logs.

Every issue must include a **Model** and **Review effort** annotation in the format described in [Model and effort selection](#model-and-effort-selection) below, so anyone picking up the issue knows the recommended reasoning capacity before starting work.

Never omit a section; write "N/A" explicitly when one doesn't apply.

### Model and effort selection

Every issue records a recommended **Model** and **Review effort** at creation time, using this format:

- "Model: Sonnet | Review effort: medium"
- "Model: Opus | Review effort: high"

Choose **Opus** with **high** effort for work that is security-critical (encryption, key rotation, participant removal/revocation), touches core distributed-systems correctness (event replication, conflict resolution, partition handling), or defines a core privacy/evidence guarantee (grounded AI answers, no query-correlated peer fetches). Choose **Sonnet** with **low** or **medium** effort for well-scoped implementation work, UI flows, and routine testing. Use your judgment for anything in between, and prefer the higher tier when in doubt for security- or privacy-sensitive work.

Before starting work on an issue, check the issue description for these annotations and use the recommended model and effort level before asking the AI to begin work. This ensures the AI has appropriate reasoning capacity and cost efficiency for the task scope.

### Commit practices

- Write clear, descriptive commit messages that start with an uppercase verb (for example, "Add authentication flow", "Fix stale cache invalidation", "Update README").
- Do not use Conventional Commits format (`docs(02): ...`, `feat: ...`). Verb-first is the only style used in this repository.
- Reference issue numbers when commits relate to a specific issue.
- Avoid auto-committing large or non-trivial changes; always give the reviewer the opportunity to inspect changes before committing.
- **AI co-authorship:** When an AI agent (Claude, GitHub Copilot, Qwen, Ollama, etc.) authors or co-authors a commit, include a co-author line with the agent name and model used. Use this pattern: `Co-Authored-By: [Agent Name] ([Model]) <[email used for attribution]>`. Use the official no-reply or attribution email for that agent identity when available. Examples:
  - `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  - `Co-Authored-By: OpenAI GPT-5.6 Sol <noreply@openai.com>`
  - `Co-Authored-By: GitHub Copilot (GPT-5.6 Terra) <223556219+Copilot@users.noreply.github.com>`
  - `Co-Authored-By: Qwen 3.5 9B <noreply@qwen.local>`
  - `Co-Authored-By: Meta Llama 3.2 3B <noreply@ollama.local>`

  This maintains clear attribution in git history and distinguishes AI-assisted work from human-only changes.

### Branch management

- Create feature branches from `main` using `feature/description` or `fix/description`.
- Keep branches focused on single features or bug fixes.

### Pull request creation guidelines

When creating a pull request, **read and follow the template in `.github/pull_request_template.md` exactly**. This is critical to ensure consistency.

PR titles follow the same verb-first convention as commit messages (for example, "Add authentication flow", "Fix stale cache invalidation") rather than Conventional Commits format, since GitHub uses the PR title as the default squash-merge commit message.

**Required process:**

1. Read the actual template file from `.github/pull_request_template.md` every time (do not rely on memory)
2. Include every section from the template in the PR body, in exact order
3. Include all checkboxes from every checklist section
4. Do not skip or omit sections

**For each checklist item:**

- Check `[x]` if completed
- Leave `[ ]` if not applicable or incomplete
- If truly not applicable, write "not applicable – [brief reason]" after the checkbox instead (e.g., "not applicable – docs only")
- Never omit checkbox items; always show the full checklist for visibility

**General guidelines:**

- Never abbreviate or paraphrase template sections
- Always include the full checklist with all items visible
- Fill out every section in the template

### Code standards

Use idiomatic HTML, CSS, JavaScript for the mockup and TypeScript for the planned app. Follow the design document’s crimson palette, currency formatting, numeric validation, and English UI text. Support a 320 CSS-pixel viewport, keyboard navigation, visible focus, field labels, inline errors, and polite result announcements. Support System, Light, and Dark appearance, live system changes, and unavailable browser storage.

Use Node.js 24.15 or later in the 24.x line, or Node.js 26 or later and Python 3. Install with `npm ci`; run `npm run dev`, `npm run build`, and `npm run preview`. Checks are `npm run typecheck`, `npm test`, and `npm run lint`. Lint includes repository text checks and reference mockup syntax validation. CI runs lint, type-checking, tests, and builds for root and project base paths.

## Privacy and security considerations

Purchase and income inputs stay in memory for the current browser session. Do not persist them or send them in requests, URLs, logs, analytics, or crash reports. Only the theme preference may be stored in browser storage. The calculation requires no account or personal data collection. Review network changes against the design document; distinguish the mockup’s currency-only rate request from production’s same-origin snapshot.

## Writing style

Follow the [Microsoft Writing Style Guide](https://learn.microsoft.com/en-us/style-guide/welcome/) for documentation and code comments. Apply its plain-language principles to UI text, issue content, and pull request content when appropriate. When these repository-specific rules conflict with the guide, follow the repository-specific rules.

### Formatting rules

This section outlines the essential formatting standards, primarily for documentation.

#### Structure and spacing

Add empty newlines after all headings. Add empty newlines before all lists. Never stack headings; always include descriptive text between them that explains what follows. Add an empty newline at the end of the document. All files must end with a newline character.

Sections must not contain only an admonition, code block, image, table, or tab; always include descriptive text after the heading. Always add an empty newline after the opening of an admonition and before the closing of an admonition. Don't add empty newlines after steps in numbered lists.

#### Headings and capitalization

Never end headings with colons. Never end a sentence with a colon if what follows next is a heading. Don't use `Introduction` or `Overview` headings since it should be obvious that the body text immediately below the H1/title describes what the doc is about.

Use sentence-style capitalization for all headings and bold-style headings (only capitalize the first word and proper nouns).

#### Lists and formatting

Avoid excessive use of bulleted lists and numbered lists. For bulleted items with colons, use `:**` not `**:` (for example, `**Item:**`). Align all rows in Markdown tables for readability in source code.
