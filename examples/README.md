# Example Project Structure

This directory shows what your project structure will look like after using the Awesome Copilot Sync extension.

## Before Using the Extension

```
my-project/
├── src/
│   ├── index.ts
│   └── utils/
└── package.json
```

## After Running Extension Commands

### 1. Initialize Project Structure
Run: `Awesome Copilot: Initialize Project Structure`

```
my-project/
├── .github/
│   ├── copilot-instructions.md   # Created with basic template
│   ├── agents/                   # Empty directory created
│   ├── instructions/             # Empty directory created
│   ├── prompts/                  # Empty directory created
│   └── skills/                   # Empty directory created
├── src/
│   ├── index.ts
│   └── utils/
├── package.json
└── AGENTS.md                     # Created with basic template
```

### 2. Configure and Sync
Run: `Awesome Copilot: Configure Repository`, then use individual sync commands (e.g., `Awesome Copilot: Sync Agents Only`)

```
my-project/
├── .github/
│   ├── copilot-instructions.md   
│   ├── agents/                   # Now contains .agent.md files
│   │   ├── code-reviewer.agent.md
│   │   ├── debugger.agent.md
│   │   ├── architect.agent.md
│   │   ├── docs-writer.agent.md
│   │   └── test-writer.agent.md
│   ├── instructions/             # Now contains .instructions.md files  
│   │   ├── typescript.instructions.md
│   │   ├── python.instructions.md
│   │   ├── javascript.instructions.md
│   │   ├── testing.instructions.md
│   │   └── code-review.instructions.md
│   ├── prompts/                  # Now contains .prompt.md files
│   │   ├── write-tests.prompt.md
│   │   ├── code-review.prompt.md
│   │   ├── refactor-code.prompt.md
│   │   ├── generate-docs.prompt.md
│   │   └── debug-issue.prompt.md
│   └── skills/                   # Now contains skill folders
│       ├── git-workflow/
│       │   └── SKILL.md
│       ├── documentation/
│       │   └── SKILL.md
│       └── testing-automation/
│           └── SKILL.md
├── src/
│   ├── index.ts
│   └── utils/
├── package.json
└── AGENTS.md                     
```

## Attribution Headers

Each synced file includes an attribution header like:

**agents/code-reviewer.agent.md**:
```markdown
<!-- Synced from: https://github.com/github/awesome-copilot/blob/main/agents/code-reviewer.agent.md -->
---
description: 'Expert code reviewer focusing on best practices and maintainability'
model: 'GPT-4.1'
tools: ['codebase', 'problems']
---

# Code Reviewer Agent
You are an expert code reviewer...
```

## Using the Resources

### In VS Code Chat
- Type `@code-reviewer` to use the code reviewer agent
- Use prompts like `/write-tests` for quick test generation
- Instructions automatically apply to files matching their patterns

### With GitHub Copilot CLI  
- Commands like `gh copilot explain` use the AGENTS.md context
- Skills provide complex multi-step workflows

## Customization

After syncing, you can:
- Edit any synced file to customize for your project
- Add your own agents, prompts, or instructions
- Re-sync to get updates while preserving your customizations