# Agent Marketplace Sync

A VS Code extension that automatically syncs GitHub Copilot agents, prompts, instructions, and skills from repositories following the [awesome-copilot](https://github.com/github/awesome-copilot) structure.

## 🚀 Features

- **🔄 Marketplace Sync**: Pull the latest index and resources from any compatible marketplace
- **📁 Project Structure Setup**: Initialize proper `.github/` directory structure
- **🔍 Find & Add Resources**: Search and add specific agents, prompts, instructions, skills, or plugins
- **⚙️ Configurable Sources**: Set custom marketplace repositories and branches
- **📝 Source Attribution**: Automatically tracks where content comes from
- **📊 Progress Tracking**: Real-time sync progress with cancellation support
- **🧪 Comprehensive Testing**: 54 tests across 5 test suites ensuring reliability

## 📦 Installation

### From Source (Development)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/gardlt/vscode-awesome-copilot.git
   cd vscode-awesome-copilot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. **Option A - Development Mode:**
   - Open the project in VS Code
   - Press `F5` (or `Cmd+Shift+P` → "Debug: Start Debugging" on Mac)
   - This opens a new Extension Development Host window

4. **Option B - Package as VSIX:**
   ```bash
   npm install -g vsce
   vsce package
   # Install the generated .vsix file through VS Code Extensions view
   ```

## 🎯 Quick Start

1. **Open VS Code** with your project folder
2. **Initialize Structure**: `Ctrl+Shift+P` → `Agent Marketplace: Initialize Project Structure`
3. **Configure Marketplace**: `Ctrl+Shift+P` → `Agent Marketplace: Configure Marketplace`
## 🔍 Find & Add Workflow

For more targeted resource management, use the Find & Add commands:

### Example: Adding a Specific Agent

1. **Search Agents**: `Ctrl+Shift+P` → `Agent Marketplace: Find and Add Agent`
2. **Browse Results**: View searchable list with descriptions, models, and tools
3. **Preview Details**: See metadata like supported models and available tools
4. **Add to Project**: Select an agent to download with attribution
5. **Open Immediately**: Choose to open the file right after adding

### Search Features
- **Fuzzy Search**: Find resources by name, description, or metadata
- **Rich Metadata**: Preview model compatibility, tools, categories, tags
- **Smart Filtering**: Match on description and detail fields
- **Instant Preview**: See complexity, domain, scope, and language info

### What Gets Added
- ✅ Original content with frontmatter metadata
- ✅ Attribution header linking to source  
- ✅ Proper directory structure creation
- ✅ Option to immediately open the added file

## 📋 Commands

| Command | Description |
|---------|-------------|
| `Agent Marketplace: Configure Marketplace` | Set the marketplace repository and branch |
| `Agent Marketplace: Sync Marketplace` | Pull the latest marketplace index and resources |
| `Agent Marketplace: Initialize Project Structure` | Create base directory structure |
| `Agent Marketplace: Find and Add Agent` | Search and add agents with metadata preview |
| `Agent Marketplace: Find and Add Instruction` | Search and add instructions with scope/language info |
| `Agent Marketplace: Find and Add Skill` | Search and add skills with domain/complexity details |
| `Agent Marketplace: Find and Add Plugin` | Search and add plugins from the marketplace |
| `Agent Marketplace: Remove Repository` | Remove a registered marketplace |
| `Agent Marketplace: Clear Repository Cache` | Clear cached repository data |
| `Agent Marketplace: Show Cache Statistics` | Display cache usage and status |

## ⚙️ Configuration

Configure the extension through VS Code Settings:

```json
{
  "agent-marketplace-sync.targetRepository": "github/awesome-copilot",
  "agent-marketplace-sync.branch": "main",
  "agent-marketplace-sync.autoSync": false,
  "agent-marketplace-sync.syncOnSave": false,
  "agent-marketplace-sync.baseDirectory": ".github",
  "agent-marketplace-sync.repositories": []
}
```

### Settings

- **`targetRepository`**: Marketplace repository to browse from (format: `owner/repo`) — matches `copilot plugin marketplace`
- **`branch`**: Git branch to sync from (default: `main`)
- **`autoSync`**: Automatically sync when workspace opens
- **`syncOnSave`**: Check for updates when saving copilot files
- **`baseDirectory`**: Base directory for synced resources — either `.github` (default, for GitHub Copilot) or `.claude` (for Claude)
- **`repositories`**: List of marketplace repositories to sync from. When populated, overrides `targetRepository`/`branch`. Each entry supports `repository` (required, `owner/repo`), `label` (optional display name), and `branch` (optional, defaults to `main`)

## 📁 Project Structure

After initialization and syncing, your project will have (using `.github` as the base directory):

```
your-project/
├── .github/                        # or .claude/ depending on baseDirectory setting
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

**Parsed Metadata**: Name, description, supported models, available tools

### 🎯 Prompts (`.prompt.md`)
Ready-to-use prompts for common development tasks:

```markdown
---
description: 'Generate comprehensive unit tests'
category: 'testing'
tags: ['unit-tests', 'automation', 'quality']
---

# Write Tests
Generate unit tests for the selected code...
```

**Parsed Metadata**: Name, description, category, tags

### 📋 Instructions (`.instructions.md`)
Coding standards applied to specific file patterns:

```markdown
---
description: 'TypeScript coding standards and conventions'
scope: 'project'
language: 'typescript'
---

# TypeScript Guidelines
Use strict TypeScript configuration...
```

**Parsed Metadata**: Name, description, scope, target language

### 🛠️ Skills (`.skill.md`)
Self-contained folders with complex workflows and bundled resources:

```markdown
---
description: 'Automated deployment workflow setup'
domain: 'DevOps'
complexity: 'intermediate'
---

# Deployment Skill
Comprehensive deployment automation...
```

**Parsed Metadata**: Name, description, domain, complexity level

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

1. **Authenticates** with GitHub using VS Code's built-in GitHub OAuth integration
2. **Fetches** directory contents from configured repository and branch
3. **Downloads** individual files with comprehensive error handling
4. **Parses** frontmatter metadata for rich resource information
5. **Creates** local directory structure automatically
6. **Adds** attribution headers to track source and enable updates
7. **Preserves** existing files while updating synced content
8. **Reports** detailed sync status with success/error counts
9. **Handles** network failures, timeouts, and API rate limits gracefully

### Error Handling Features
- **Network Resilience**: Graceful handling of connection issues
- **API Error Recovery**: Proper handling of 404, rate limits, and server errors  
- **User Feedback**: Clear progress indicators and error messages
- **Partial Sync Support**: Continue processing even if individual files fail
- **Cancellation Support**: Allow users to stop long-running sync operations

## 🛠️ Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch

# Lint the code
npm run lint
```

### Testing

The extension includes a comprehensive test suite with 54 tests across 5 test suites:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

#### Test Coverage
- **metadata-parsing.test.ts**: Agent, prompt, instruction, and skill metadata parsing
- **github-api.test.ts**: GitHub API integration and HTTP error handling  
- **vscode-integration.test.ts**: VS Code API interactions and user interface
- **file-operations.test.ts**: File system operations and directory management
- **integration.test.ts**: End-to-end workflow testing

### Debugging

1. Open this project in VS Code
2. Press `F5` (or `Cmd+Shift+P` → "Debug: Start Debugging" on Mac)
3. This opens a new Extension Development Host window
4. Test commands in the new VS Code window
5. View output in the original VS Code Debug Console

### Extension Structure

```
src/
├── extension.ts              # Main extension logic with all commands
├── test/                     # Comprehensive test suite
│   ├── setup.ts             # Global VS Code API mocking
│   ├── metadata-parsing.test.ts
│   ├── github-api.test.ts
│   ├── vscode-integration.test.ts
│   ├── file-operations.test.ts
│   └── integration.test.ts
├── package.json             # Extension manifest and dependencies
├── jest.config.js           # Jest testing configuration
└── tsconfig.json           # TypeScript configuration
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