# Awesome Copilot Sync

A VS Code extension that automatically syncs GitHub Copilot agents, prompts, instructions, and skills from repositories following the [awesome-copilot](https://github.com/github/awesome-copilot) structure.

## 🚀 Features

- **🔄 Automatic Repository Sync**: Pull content from any compatible repository
- **📁 Project Structure Setup**: Initialize proper `.github/` directory structure
- **🎯 Selective Syncing**: Choose what to sync (agents, prompts, instructions, skills)
- **⚙️ Configurable Sources**: Set custom repositories and branches
- **📝 Source Attribution**: Automatically tracks where content comes from
- **🔍 Progress Tracking**: Real-time sync progress with cancellation support

## 📦 Installation

1. Clone or download this repository
2. Open in VS Code
3. Press `F5` to run in development mode, or package as VSIX for installation

## 🎯 Quick Start

1. **Open VS Code** with your project folder
2. **Initialize Structure**: `Ctrl+Shift+P` → `Awesome Copilot: Initialize Project Structure`
3. **Configure Repository**: `Ctrl+Shift+P` → `Awesome Copilot: Configure Repository`
4. **Sync Everything**: `Ctrl+Shift+P` → `Awesome Copilot: Sync All Resources`

## 📋 Commands

| Command | Description |
|---------|-------------|
| `Awesome Copilot: Configure Repository` | Set target repository and branch |
| `Awesome Copilot: Initialize Project Structure` | Create `.github/` directory structure |
| `Awesome Copilot: Sync All Resources` | Download all agents, prompts, instructions, and skills |
| `Awesome Copilot: Sync Agents Only` | Download only `.agent.md` files |
| `Awesome Copilot: Sync Prompts Only` | Download only `.prompt.md` files |
| `Awesome Copilot: Sync Instructions Only` | Download only `.instructions.md` files |
| `Awesome Copilot: Sync Skills Only` | Download only skill folders |

## ⚙️ Configuration

Configure the extension through VS Code Settings:

```json
{
  "awesome-copilot-sync.targetRepository": "github/awesome-copilot",
  "awesome-copilot-sync.branch": "main",
  "awesome-copilot-sync.autoSync": false,
  "awesome-copilot-sync.syncOnSave": false
}
```

### Settings

- **`targetRepository`**: Repository to sync from (format: `owner/repo`)
- **`branch`**: Git branch to sync from (default: `main`)
- **`autoSync`**: Automatically sync when workspace opens
- **`syncOnSave`**: Check for updates when saving copilot files

## 📁 Project Structure

After initialization and syncing, your project will have:

```
your-project/
├── .github/
│   ├── copilot-instructions.md     # 📄 Main Copilot instructions
│   ├── agents/                     # 🤖 Specialized chat agents
│   │   ├── code-reviewer.agent.md
│   │   ├── debugger.agent.md
│   │   └── architect.agent.md
│   ├── instructions/               # 📋 File-specific coding standards
│   │   ├── typescript.instructions.md
│   │   ├── python.instructions.md
│   │   └── testing.instructions.md
│   ├── prompts/                    # 🎯 Reusable task prompts
│   │   ├── write-tests.prompt.md
│   │   ├── code-review.prompt.md
│   │   └── refactor-code.prompt.md
│   └── skills/                     # 🛠️ Advanced workflow skills
│       ├── git-workflow/
│       └── deployment/
├── AGENTS.md                       # 📖 Agent instructions for CLI usage
└── your-source-files...
```

## 🎨 File Types Explained

### 🤖 Agents (`.agent.md`)
Specialized GitHub Copilot chat modes with specific expertise:

```markdown
---
description: 'Code review specialist focusing on best practices'
model: 'GPT-4.1'
tools: ['codebase', 'problems']
---

# Code Review Agent
You are an expert code reviewer...
```

### 🎯 Prompts (`.prompt.md`)
Ready-to-use prompts for common development tasks:

```markdown
---
agent: 'agent'
description: 'Generate comprehensive unit tests'
tools: ['codebase']
---

# Write Tests
Generate unit tests for the selected code...
```

### 📋 Instructions (`.instructions.md`)
Coding standards applied to specific file patterns:

```markdown
---
description: 'TypeScript coding standards and conventions'
applyTo: '**/*.ts, **/*.tsx'
---

# TypeScript Guidelines
Use strict TypeScript configuration...
```

### 🛠️ Skills
Self-contained folders with complex workflows and bundled resources.

## 🌟 Compatible Repositories

This extension works with any repository following the awesome-copilot structure:

- **[github/awesome-copilot](https://github.com/github/awesome-copilot)** - The original collection
- **Your custom repository** - Create your own collection following the same structure

### Repository Requirements

```
your-repo/
├── agents/           # .agent.md files
├── prompts/          # .prompt.md files  
├── instructions/     # .instructions.md files
├── skills/           # Folders with SKILL.md files
└── (optional) collections/  # .yml collection files
```

## 🔄 Sync Process

1. **Fetches** directory contents from GitHub API
2. **Downloads** individual files with attribution headers
3. **Creates** local directory structure
4. **Preserves** existing files while updating synced content
5. **Reports** sync status and any errors

## 🛠️ Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

### Debugging

1. Open this project in VS Code
2. Press `F5` to start Extension Development Host
3. Test commands in the new VS Code window
4. View output in the original VS Code Debug Console

### Extension Structure

```
src/
├── extension.ts          # Main extension logic
package.json             # Extension manifest
tsconfig.json           # TypeScript configuration
```

## 📝 Attribution

All synced files include automatic attribution headers:

```markdown
<!-- Synced from: https://github.com/github/awesome-copilot/blob/main/agents/code-reviewer.agent.md -->
```

This ensures you always know the source of your content and can track updates.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[MIT License](LICENSE) - Feel free to use and modify as needed.

## 🆘 Support

- **Issues**: Report bugs and feature requests in the GitHub Issues
- **Discussions**: Share ideas and get help in GitHub Discussions
- **Documentation**: Check the [awesome-copilot documentation](https://github.com/github/awesome-copilot) for more details on file formats

---

**Ready to supercharge your GitHub Copilot experience?** Install this extension and start syncing amazing community resources! 🚀