# Custom agents for Japan Purchasing Power Calculator

This directory contains project-specific Claude Code subagents. They follow the Vite app and preserved reference mockup.

## Available agents

The following specialized agents help automate development workflows for this project.

### Build and quality assurance

These agents handle compilation, code quality checks, and automated testing workflows.

**builder:** Build specialist that compiles the project and builds it for different configurations. Handles build errors and dependency issues. Example usage: "Use builder to build the project in mockup validation"

**lint-checker:** Code quality specialist that analyzes code for style violations and enforces coding standards. Example usage: "Use lint-checker to lint modified files"

**test-runner:** Testing specialist that runs unit, integration, and end-to-end tests. Example usage: "Use test-runner to run all unit tests"

### Debugging and performance

These agents specialize in diagnosing failures and optimizing performance.

**debugger:** Debugging specialist that diagnoses crashes, runtime errors, and integration failures using logs and stack traces. Example usage: "Use debugger to analyze this crash log"

**performance-profiler:** Performance specialist that profiles hot paths, startup time, and resource usage against the project's performance targets. Example usage: "Use performance-profiler to check performance with a large dataset"

### Privacy review

**privacy-auditor:** Verifies that financial inputs remain in memory and do not enter storage or network requests, and that usage analytics runs only after opt-in. Example usage: "Use privacy-auditor to audit this PR before merge"

### GitHub workflow

These agents automate GitHub interactions while following project conventions and templates.

**github-issue-creator:** GitHub workflow specialist that creates well-formed issues following the project template at `.github/ISSUE_TEMPLATE/standard-issue-template.md`. Example usage: "Use github-issue-creator to file a bug for the incorrect income equivalent"

**pr-creator:** Pull request specialist that creates well-structured PRs with clear descriptions and testing notes, following the PR template. Example usage: "Use pr-creator to open a PR for the currency picker"

## How to use agents

Agents are invoked by referencing them in natural language requests to Claude Code. When you ask Claude to perform a task that matches an agent's specialty, you can explicitly request that agent or Claude may automatically delegate to the appropriate agent.

### Invoking agents explicitly

To explicitly use a specific agent, include the agent name in your request using the pattern "Use the [agent-name] to [task description]". Here are practical examples:

**Building and testing:**

- "Use the builder to build the app in mockup syntax validation"
- "Use the test-runner to run all unit tests and report failures"
- "Use the lint-checker to analyze code quality in the calculator files"

**Debugging and performance:**

- "Use the debugger to analyze why the currency restoration fails"
- "Use the performance-profiler to check input and rendering performance"

**GitHub workflows:**

- "Use the github-issue-creator to file a bug for the missing rate date"
- "Use the pr-creator to open a pull request for the currency picker"

### Automatic agent selection

Claude Code can automatically select the appropriate agent based on your request context. For example, asking "Can you run the tests?" may automatically invoke the test-runner agent. You can override this by explicitly naming a different agent if needed.

### Viewing available agents

To see all available agents in your session, use the `/agents` command. This displays project-specific agents from this directory, user-level agents from your home directory, and built-in system agents. Each agent listing shows its name, description, and configured tools.

## Agent design philosophy

These agents are meant to encode this project's specific, non-obvious constraints—the things a generic assistant would get wrong by default, not general good practice it already knows. Update agent commands as the production toolchain is implemented; do not report mockup syntax checks as application tests.

## Customization

Each agent is defined in a Markdown file with YAML frontmatter followed by a system prompt. To customize an agent, edit the corresponding `.md` file to modify the system prompt or tool permissions. Changes take effect automatically without requiring a restart. For detailed information about agent configuration options, see the [Claude Code documentation](https://github.com/anthropics/claude-code) for the agent system.

## Contributing

When adding new agents to this directory, follow the existing naming convention using lowercase with hyphens. Use clear, descriptive names that indicate the agent's purpose. Document the agent's capabilities and provide example usage in this README. Specify appropriate tools and model in the YAML frontmatter based on the agent's complexity. Test thoroughly before committing to ensure the agent behaves as expected across different scenarios.

App commands: `npm run build`, `npm run typecheck`, `npm test`, and `npm run lint`. Use `npm run build -- --base=/yenlens/` to verify project asset paths.
