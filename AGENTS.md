# AI assistant configuration

This file contains configuration and guidelines for AI assistants when working on this repository. It follows the [AGENTS.md](https://agents.md) convention and is read directly by GitHub Copilot; Claude Code reads it via the `@AGENTS.md` import in `CLAUDE.md`.

> **This is a template.** Placeholders look like `{{THIS}}` and optional sections are wrapped in `<!-- OPTIONAL: ... -->` HTML comments. See the root [`README.md`](README.md) for full instructions on adapting this file to a real project, including the prompt block written specifically for an AI assistant to follow.
>
> **Template completion contract for AI assistants:** If a required placeholder value is missing from repository context, ask the user instead of guessing. Do not leave unresolved placeholders in production instructions.

## Important notes

**GIT SAFETY:** NEVER force push to any branch. Force pushes can:

- Overwrite remote history and cause data loss.
- Accidentally commit files that should be in .gitignore.
- Invalidate pull requests and break collaboration.

Always use `git push` without `--force` or `--force-with-lease`. If you need to undo work, use `git revert` instead of `git push --force` or `git push --force-with-lease`.

## Documentation references

For detailed information about this project, refer to the following internal documentation. Delete any row that doesn't apply and add rows for docs this project actually has.

- **Repository overview:** See `README.md` for a general project description.
- **Product or design docs:** `{{path to product requirements, design docs, or architecture notes, if this project has them}}`

<!-- OPTIONAL: controlled vocabularies pattern
- **Controlled vocabularies:** If the project has fixed ID/string tables (enum-like values that ship in a public format, a database, or an API contract), point to where they're defined here. Note explicitly whether IDs are permanent once shipped and never reused, since that constraint changes how an AI assistant should approach schema changes.
-->

- **Any other related docs:** Refer to any other docs in the `docs/` folder for additional architecture context, if present.

## Repository overview

{{PROJECT_NAME}} is {{a one- or two-sentence description of what this project is and who it's for}}.

### Key components

{{Describe the major pieces of the system—e.g. "a CLI", "a REST API and a web frontend", "a single-target mobile app"—and how they relate.}}

### Architecture patterns

{{Describe the architectural rules an AI assistant should never violate: the data model, what talks to what, what must never happen (e.g. "no direct database access from the frontend", "all writes go through the queue"). Concrete, load-bearing constraints belong here, but general good practice does not.}}

## Development workflow

Follow these guidelines to maintain code quality and project consistency.

### Issue creation guidelines

When creating a GitHub issue, provide clear descriptions of bugs or feature requests including steps to reproduce, expected vs. actual behavior, environment details, and relevant logs.

<!-- OPTIONAL: requirement-ID cross-referencing pattern
For features, describe the user need and reference the relevant requirement ID (e.g. a PRD/spec identifier like FR-9) if the project tracks requirements that way. Propose a solution.
-->

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

Follow idiomatic conventions for {{primary language(s)}} with consistent indentation and naming. {{Add any project-specific style targets here, such as a design language, minimum platform version, compatibility target, accessibility baseline, or performance budget. Delete this sentence if there is nothing beyond standard idiomatic style.}}

<!-- OPTIONAL: accessibility and internationalization pattern
Every screen must remain fully legible under the platform's accessibility display modes (reduced transparency/motion, high contrast) and must support user-adjustable text size and screen readers. If the interface ships in more than one language, treat all shipped locales as equal-quality, not a primary language plus a translation pass. Never hardcode user-facing strings.
-->

## Privacy and security considerations

This section is optional. Keep it only if the project has hard, load-bearing constraints an AI assistant could otherwise violate by accident (a wire-format boundary, a "never call this API" rule, a metadata-stripping step); otherwise delete the whole section, including this paragraph. The commented block below is a worked example to adapt.

<!-- OPTIONAL: privacy and security worked example

Treat privacy as a top constraint, not a feature to add later, if it is materially important to this product.

### The no-server rule (example pattern)

If this project is meant to be local-first or offline-first, state explicitly what that rules out: no developer-operated backend, no account system, no analytics SDK, no third-party network call. Any feature design that violates this is out of scope by definition, not a cost trade-off.

### Sensitive input handling (example pattern)

If the project imports user media or personal data, name the specific stripping/sanitization step that must never regress (e.g. "photos are re-encoded to strip EXIF/GPS on import, never byte-copied") and why it matters. A "safe" default that's invisible unless deliberately checked is exactly the kind of thing worth calling out here.

### The wire boundary (example pattern)

If there's a public/exported data format that's a strict subset of the internal model, name both types and state the rule in one sentence: which fields may never appear on the wire, and that the mapping between the two types must stay explicit and hand-written rather than derived automatically.

### AI grounding (example pattern)

If the project has AI/LLM features, state what they must never do—e.g. "must never invent details not present in the source data"—and where in the docs the grounding/verification rules live.

-->

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
