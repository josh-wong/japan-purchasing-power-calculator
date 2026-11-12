## Summary

<!-- Brief description of what this PR accomplishes, starting with "This PR ..." -->

## Related issues or PRs

<!-- Use a closing keyword so GitHub links the issue under Development and auto-syncs assignee/labels, for example: Resolves #123, Fixes #123, Closes #123. For a non-closing reference, use "Relates to #456". If a related issue or PR doesn't exist, write "N/A". -->
-

## Changes made

<!-- List specific changes with bullet points -->
-
-
-

## Technical implementation

<!-- Describe architectural decisions, patterns used, etc. -->
- **Approach:**
- **Key files modified:**
- **Dependencies added/removed:**
- **Design patterns used:**

## Testing performed

<!-- Retain every checklist item. Mark completed items with [x]. Leave incomplete items unchecked. If an item doesn't apply, leave it unchecked and append "not applicable – [brief reason]". Keep checklist items consecutive with no blank lines between them. Use exactly one blank line between the final checklist item and the next heading. -->
- [ ] Code compiles without errors or warnings
- [ ] Tested core functionality works as expected
- [ ] Tested edge cases and error handling
- [ ] Unit tests added or updated (if applicable)
<!-- OPTIONAL: platform/accessibility/localization testing pattern. Uncomment and adapt the items that apply to this project, delete the rest. Keep retained checklist items directly adjacent to the standard checklist with no blank line.
- [ ] Tested with no network connection
- [ ] Tested in light mode
- [ ] Tested in dark mode
- [ ] Tested with reduced transparency / high contrast display settings
- [ ] Tested with larger accessibility text sizes
- [ ] Tested with a screen reader
- [ ] Tested in all supported locales
- [ ] Tested on a physical device (if the target platform behaves differently than its simulator/emulator)
-->

## Privacy and security considerations

<!-- Mark applicable items with [x]. Add PR-specific notes below any relevant item. -->
- [ ] No new data leaves the system without updating any relevant user-facing disclosure
- [ ] No new network calls, telemetry, analytics SDK, or crash reporter added without review
- [ ] Error messages and logs don't leak sensitive data
<!-- OPTIONAL: wire-boundary / sensitive-input pattern. Keep and adapt if this project has an exported/wire type distinct from its internal model, or handles sensitive media/PII on import. Keep retained checklist items directly adjacent to the standard checklist with no blank line.
- [ ] The exported/wire format still contains no fields meant to stay private.
- [ ] Sensitive input (photos, location, etc.) is still sanitized on import as required.
- [ ] Any AI-generated output stays grounded in real data—no invented facts.
-->

## Code quality

<!-- Verify these items -->
- [ ] Code follows project conventions and patterns
- [ ] Added appropriate comments for non-obvious logic only
- [ ] No hardcoded strings that should be localized (if the project supports multiple locales)
- [ ] Proper error handling implemented
- [ ] No debugging code or print statements left in
- [ ] Removed unused imports and variables

## Breaking changes

<!-- Does this PR change a persisted schema, a public API, or a wire/exchange format? -->
- [ ] No breaking changes
- [ ] Schema or data-model version change (describe migration below)
- [ ] API or wire-format version change (describe backward-compatibility handling below)

## Additional context

<!-- Any extra information for reviewers, screenshots, performance notes, etc. -->
