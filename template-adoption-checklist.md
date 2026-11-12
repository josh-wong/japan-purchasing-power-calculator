# Template adoption checklist

Tracks which repos under `~/Documents/GitHub` are missing files from this template or contain older template-managed files that need to be reconciled. Generated 2026-09-21.

## Background

This repo (`template-ai-agents`) is a template for configuring AI coding assistants (Claude Code, GitHub Copilot, and similar tools) consistently across all of Josh's personal repos. It defines things like: which agent instructions apply, how issues and PRs should be filled out, and what files those tools should ignore.

Each repo in `~/Documents/GitHub` should have its own copy of the template files listed below, adapted to that repo. Over time, some repos were created before the template existed, or were never updated after it changed — this checklist tracks which ones need the files added or refreshed.

## What each template file does

- **`AGENTS.md`** — the main instruction file read by GitHub Copilot and any AI tool following the [AGENTS.md](https://agents.md) convention. Contains repo overview, architecture rules, commit/branch/PR conventions, and code standards.
- **`CLAUDE.md`** — a thin wrapper that points to and imports `AGENTS.md` (`@AGENTS.md`) so Claude Code picks up the same instructions automatically.
- **`.claudeignore`** / **`.copilotignore`** — tell Claude Code / Copilot which files or folders to exclude from context (for example, build artifacts, secrets, generated files).
- **`.github/pull_request_template.md`** — the required PR template; AI assistants are instructed to follow it exactly when opening PRs.
- **`.github/ISSUE_TEMPLATE/standard-issue-template.md`** — the standard issue template, which also requires a "Model" and "Review effort" annotation on every issue.
- **`.claude/agents/`** — a folder of predefined subagents (builder, debugger, lint-checker, pr-creator, and so on) that Claude Code can invoke for specific tasks.

## How to bring a repo up to date

1. Build an inventory of every template-managed path that exists in `template-ai-agents`. For each applicable path, either copy the missing file or compare the target repository's existing file against the master copy. File presence alone does not mean its contents are current.
2. Open `AGENTS.md` and fill in the placeholders (`{{THIS}}` style) with details specific to that repo — project name, description, key components, architecture rules, primary language. Don't leave placeholders unresolved.
3. Copy `CLAUDE.md` as-is. It must remain the thin importer for `AGENTS.md`; do not maintain a second independent instruction set there.
4. Review `.claudeignore` and `.copilotignore`, and adjust for anything repo-specific that should be excluded.
5. Reconcile every existing template-managed file with the master. Preserve all master-required sections, rules, checklist items, and safety language. Apply project-specific substitutions only where the master contains a placeholder, optional block, or an explicitly customizable list.
6. Commit the changes on a branch (for example, `feature/adopt-ai-agent-template`) and open a PR using the reconciled PR template.
7. Check the repo off in this file only after both missing-file adoption and existing-file synchronization are complete.

Repos marked "Missing everything" have no template files at all and need the full set copied over. Repos under "Partial" already have some files. Add the files listed next to them, then reconcile the existing files called out below so old and new instructions do not conflict.

## Master synchronization contract

`template-ai-agents` is the master source for AI-assistant configuration. Every adoption or refresh must compare all applicable files at matching relative paths, including files that already exist in the target repository. Do not assume an existing file is current merely because the missing-file checklist does not list it.

The following rules define what "match the template" means.

- **Exact-copy files:** `CLAUDE.md` should match the master exactly unless the master itself changes.
- **Required-structure files:** `.github/ISSUE_TEMPLATE/standard-issue-template.md` and `.github/pull_request_template.md` must contain every section, instruction, and checklist item from the master in the same order. Project-specific additions may supplement them but must not replace or remove master content. In particular, every issue template must include **Model and review effort**.
- **Adapted instruction files:** `AGENTS.md` and `.claude/agents/*.md` must start from the current master files, resolve every placeholder and optional block, and preserve all non-optional conventions and safety rules. Specialized agents must agree with `AGENTS.md` on commits, branches, issues, PRs, privacy, and validation.
- **Adapted ignore files:** `.gitignore`, `.claudeignore`, and `.copilotignore` must preserve the applicable baseline secret, editor, and temporary-file patterns from the master, then add the target repository's stack-specific generated files and dependencies.
- **Workflow files:** If a target repository contains a workflow at the same relative path as a master workflow, compare it with the master and preserve the master workflow contract while filling in repository-specific commands and configuration. Do not add optional workflows solely to make the file lists identical when the workflow does not apply.
- **Project-owned files:** A real project's `README.md` and `LICENSE` are project artifacts rather than files to overwrite with the template versions. Review them only for the explicit adoption tasks described in the master README.

Use a path-based diff rather than relying on filenames from memory. At minimum, inspect the shared paths under `.claude/`, `.github/`, and the repository root, and document intentional differences in the adoption PR.

## Fully complete

- [x] campfire
- [x] kokoask
- [x] seedyrip
- [x] shikai-monitor
- [x] taorc

## Missing everything

- [x] bug-bounties
- [ ] ~~mfing-suggester~~
- [ ] ~~pdf-scraper~~
- [ ] ~~slack-mcp-server~~

## Partial

- [ ] alignee — AGENTS.md, CLAUDE.md, .claudeignore, .copilotignore
- [ ] derp — AGENTS.md, CLAUDE.md, .claudeignore, .copilotignore, .claude/agents
- [ ] genbo-ios — AGENTS.md, .claudeignore, .copilotignore, .claude/agents
- [ ] into-tokyo-ios — AGENTS.md, .claudeignore, .copilotignore, .claude/agents
- [ ] josh-wong.github.io — AGENTS.md, CLAUDE.md, .claudeignore, .copilotignore, ISSUE_TEMPLATE, .claude/agents
- [ ] ketsugi — AGENTS.md, .claude/agents
- [ ] music-player-ios — AGENTS.md, .claudeignore, .copilotignore
- [ ] parade-ai — AGENTS.md, .claude/agents
- [ ] paydl — AGENTS.md, CLAUDE.md, .claudeignore, .copilotignore, .claude/agents
- [ ] snipii — AGENTS.md, .claudeignore, .copilotignore, .claude/agents
- [ ] tegata — AGENTS.md, .claude/agents
- [ ] usbwhack — AGENTS.md, CLAUDE.md, .claudeignore, .copilotignore, ISSUE_TEMPLATE, .claude/agents

## Existing files to reconcile

This audit supplements the missing-file list above. The findings name known problems, but they are not a substitute for the full shared-path comparison required by the [Master synchronization contract](#master-synchronization-contract). Before marking a repository complete, verify every applicable file that shares a path with the master, even when it is not mentioned below.

- [ ] **alignee:** PR #93 resolves the known Conventional Commits, Core Data, obsolete leaderboard, and inapplicable SwiftLint guidance. Before completion, perform an exact shared-path comparison and update the issue and PR templates so every master section, instruction, and checklist item is retained verbatim before project-specific additions.
- [ ] **derp:** Synchronize the full existing issue and PR templates with the master, retaining all master content before the repository's customized security and breaking-change additions. Then diff every other shared template path.
- [ ] **genbo-ios:** Move useful project-specific content from the long-form `CLAUDE.md` into `AGENTS.md`, replace `CLAUDE.md` with the exact thin importer, remove Conventional Commits guidance, synchronize both GitHub templates with the master, and diff every other shared template path.
- [ ] **into-tokyo-ios:** Move useful project-specific content from the long-form `CLAUDE.md` into `AGENTS.md`, replace `CLAUDE.md` with the exact thin importer, remove Conventional Commits guidance, synchronize both GitHub templates with the master, and diff every other shared template path.
- [ ] **josh-wong.github.io:** Synchronize the existing PR template with every master section, instruction, and checklist item before adding Docusaurus-specific checks. Recheck all other shared paths changed in PR #288 against the master.
- [ ] **ketsugi:** Replace the `CLAUDE.md` pointer to `ai-instructions.md` with the exact `@AGENTS.md` importer after moving canonical guidance into `AGENTS.md`. Synchronize both GitHub templates, merge the master baseline into both ignore files, and diff every other shared template path.
- [ ] **music-player-ios:** Verify that the updated PR uses the exact thin `CLAUDE.md` importer, aligns every existing agent with `AGENTS.md`, synchronizes the complete issue and PR templates rather than only adding missing sections, and diffs every other shared template path.
- [ ] **parade-ai:** Move useful project-specific content from the long-form `CLAUDE.md` into `AGENTS.md`, replace `CLAUDE.md` with the exact thin importer, synchronize both GitHub templates, preserve Electron-specific additions after master content, and diff every other shared template path.
- [ ] **paydl:** Synchronize the full existing issue and PR templates with the master, then diff every other shared template path while adding the missing files listed above.
- [ ] **snipii:** Move useful project-specific content from the long-form `CLAUDE.md` into `AGENTS.md`, replace `CLAUDE.md` with the exact thin importer, remove Conventional Commits guidance, synchronize both GitHub templates, and diff every other shared template path.
- [ ] **tegata:** Move the long-form `CLAUDE.md` guidance into `AGENTS.md`, replace `CLAUDE.md` with the exact thin importer, remove its duplicated Commit practices heading, synchronize both GitHub templates, preserve security and Go-specific additions after master content, and diff every other shared template path.
- [ ] **usbwhack:** Replace or substantially adapt the existing documentation-site PR template while retaining every master section, instruction, and checklist item. Add the missing issue template and diff every other shared template path.

When reconciling existing files, also search all template-managed content for `Conventional Commits`, `Core Data`, obsolete service or architecture names, old branch rules, missing AI co-author requirements, unresolved `{{...}}` placeholders, and `OPTIONAL` markers. Run `git diff --check` before committing.
