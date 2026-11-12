# template-ai-agents

> [!IMPORTANT]
> 
> This template is intentionally optimized for repositories owned by [josh-wong](https://github.com/josh-wong), which means it is designed for a one-user workflow and may keep owner-specific defaults where noted.

This is a starting point for new repositories: a set of AI-assistant instructions, Claude Code subagents, and GitHub workflow/template files that already encode good defaults (git safety rules, PR/issue structure, commit conventions) but leave the project-specific parts as placeholders. It's meant to be used with an AI coding assistant (Claude Code, GitHub Copilot, or similar) doing the filling-in, not filled in by hand.

## What's in this template

Items are listed alphabetically by path for quick scanning.

| Path                                                | Purpose                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.claude/agents/*.md`                               | Claude Code subagents (builder, lint-checker, test-runner, debugger, performance-profiler, github-issue-creator, pr-creator, and the optional privacy-auditor), each with `{{fill in}}` placeholders for this project's real commands and constraints. |
| `.claude/agents/README.md`                          | Explains the agents and how to invoke them.                                                                                                                                                                                                            |
| `.github/ISSUE_TEMPLATE/standard-issue-template.md` | Default issue template.                                                                                                                                                                                                                                |
| `.github/pull_request_template.md`                  | Default PR template, including testing/privacy/breaking-change checklists with optional sections.                                                                                                                                                      |
| `.github/workflows/auto-assign-and-label.yaml`      | Assigns new issues and pull requests to the configured owner and copies labels from a linked issue to its pull request. Keep it unless the target repository explicitly opts out, and set `ASSIGNEE` to the intended GitHub username.                  |
| `.github/workflows/auto-backport-pr.yaml`           | Optional. Calls a reusable workflow for backporting merged PRs to version branches. Keep only if you maintain a compatible reusable workflow and have set its reference.                                                                               |
| `.github/workflows/build-and-test.yaml`             | CI skeleton. Needs a real build/test job for this project's language.                                                                                                                                                                                 |
| `.github/workflows/claude.yml`                      | Optional. Lets `@claude` be mentioned on issues/PRs to trigger Claude Code in CI. Keep only if the repo will use Claude Code in GitHub Actions, and set the `CLAUDE_CODE_OAUTH_TOKEN` secret.                                                          |
| `.github/workflows/lint.yaml`                       | CI skeleton. Needs a real linter for this project's language.                                                                                                                                                                                         |
| `.gitignore`, `.claudeignore`, `.copilotignore`     | Generic ignore rules (secrets, IDE files, temp files) plus a commented menu of language-specific entries to uncomment.                                                                                                                                 |
| `AGENTS.md`                                         | The main instruction file for AI assistants. Repo overview, architecture rules, git/commit/PR/branch conventions, code standards, formatting rules. Read directly by Copilot; imported into `CLAUDE.md` for Claude Code.                              |
| `CLAUDE.md`                                         | Thin file that imports `AGENTS.md` so Claude Code loads the same instructions. Rarely needs edits.                                                                                                                                                     |
| `LICENSE`                                           | MIT license text. Keep as-is for open-source repositories, or change it to a different type of license for private repositories.                                                                                                                       |

## Placeholder conventions

Two markers are used throughout these files.

- `{{LIKE_THIS}}` marks a value to substitute directly—a project name, a command, a path.
- `<!-- OPTIONAL: ... -->` (or the equivalent `#`-commented block in YAML) marks a whole pattern that only applies to some projects—keep and fill in, or delete the block entirely, based on whether it fits.

Nothing in these files should ship to a real project with a `{{...}}` or an unresolved `OPTIONAL` block still in it.

As a practical rule for AI assistants: if a placeholder cannot be resolved from the prompt or repository context, ask the user instead of guessing.

## Setting up a new project from this template

The fastest path is to hand this whole section to an AI assistant. If doing it by hand instead: read `AGENTS.md` and `.claude/agents/*.md` top to bottom, replace every `{{...}}` placeholder, and for every `OPTIONAL` block decide whether it applies to this project and either fill it in or delete it.

## Instructions for AI assistants

If you are an AI assistant asked to "set up this template for my project," "adapt this template," or similar, follow this process. Do not silently invent answers to the questions below. Instead, ask the user, unless they've already given you the answer in their request.

For an existing repository, begin with a path-based inventory of this template and the target repository. Check every applicable template-managed path, including files and workflows that already exist in the target. File presence alone is not evidence that its contents are current. Preserve repository-specific additions and equivalent differently named workflows, but reconcile the shared policy, required sections, metadata, assignment behavior, and checklist items with this master before declaring adoption complete.

**1. Gather the project's identity.** Ask (or infer from context already given) whatever you don't already know:

- Project name and a one- or two-sentence description
- Primary language(s)/framework(s) and target platform(s)
- Build command, test command, and lint tool/command
- Whether there's an existing PRD, spec, or design doc to reference (and its path), or none yet
- Whether privacy/data-minimization or another architecture constraint is load-bearing enough to need an agent and an AGENTS.md section dedicated to it (this determines whether `privacy-auditor.md` stays or gets deleted)
- Whether the project supports multiple locales, needs specific accessibility testing, or has other platform-specific QA steps for the PR template's optional testing block
- Whether the project has a persisted schema or a public/exported data format distinct from its internal model (this determines whether the wire-boundary `OPTIONAL` blocks apply)
- Default PR/issue assignee, if any

**2. Fill in `AGENTS.md`.** Replace `{{PROJECT_NAME}}` and the repository-overview/architecture-patterns placeholders with real content. For each `OPTIONAL` block (documentation references, requirement-ID pattern, accessibility/i18n, the entire privacy and security section), keep and fill in only what applies—delete the rest along with its `<!-- OPTIONAL -->` markers. Leave the git safety rules, commit practices, branch management, PR guidelines, model/effort selection, and formatting rules sections as they are; they're not project-specific.

**3. Fill in the agents in `.claude/agents/`.** For each `.md` file, replace the `{{fill in}}` placeholders with the project's real build/test/lint commands and its actual hard-to-get-wrong architectural rules—don't leave them as generic restatements of good practice. Delete `privacy-auditor.md` (and its line in `.claude/agents/README.md`) if privacy isn't a load-bearing constraint for this project. Update `.claude/agents/README.md`'s title and any agent list changes to match.

**4. Fill in the GitHub workflow files.** Keep `auto-assign-and-label.yaml` unless the user explicitly opts out, set its `ASSIGNEE` value, and verify that both issue assignment and pull-request assignment/label synchronization are wanted. In `build-and-test.yaml` and `lint.yaml`, replace the placeholder `runs-on` and step with the project's real setup/build/test/lint steps (the commented examples in each file cover Node, Python, Go, and Swift—use them as a starting point, then delete the comment block). If an existing differently named workflow already provides equivalent build, test, or lint coverage, preserve that workflow and document the intentional filename difference instead of adding duplicate CI. Decide whether `auto-backport-pr.yaml` applies (delete it if not), and if it stays, set both the reusable-workflow reference and `project_base_name`. Keep `claude.yml` only if this repository will use Claude Code in Actions.

**5. Fill in the GitHub templates.** In `pull_request_template.md`, resolve each `OPTIONAL` block (platform/accessibility/localization testing, wire-boundary/sensitive-input privacy items) the same way—keep and adapt, or delete. In `standard-issue-template.md`, set a default assignee if the user wants one.

**6. Fill in the ignore files.** Uncomment the language-specific sections that match the project in `.gitignore`, `.claudeignore`, and `.copilotignore`, then delete examples that do not apply. Include package-manager and build-cache directories for the chosen stack so AI tools do not waste context on generated files.

**7. Verify no placeholders remain.** Search the repo for `{{` and `OPTIONAL` (for example, `rg -n "\\{\\{" .` and `rg -n "OPTIONAL" .`) and confirm every match was intentionally resolved, not missed.

**7b. Verify no unintended template-owner specifics remain.** Search for owner-specific values inherited from this template (for example, personal workflow repo names, personal package scopes, or private URLs) and replace or delete anything that is not intentionally kept.

**8. Update this README and LICENSE.** Once the template is filled in for a real project, this README has served its purpose; replace it with a normal project README (what the project is, how to run it, how to contribute), or fold any still-relevant setup notes into it and remove the template-specific sections above. Also replace the LICENSE copyright holder line.
