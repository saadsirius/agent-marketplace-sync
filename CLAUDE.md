# Awesome Copilot Sync VS Code Extension

This VS Code extension allows you to sync GitHub Copilot agents, prompts, instructions, and skills from repositories that follow the [awesome-copilot](https://github.com/github/awesome-copilot) structure.

## Features

- 🔄 **Automatic Syncing**: Pull agents, prompts, instructions, and skills from any compatible repository
- 📁 **Structure Initialization**: Automatically create the proper `.github/` directory structure
- ⚙️ **Configurable**: Set custom target repositories and branches
- 🎯 **Selective Sync**: Sync specific resource types (agents, prompts, instructions, skills)
- 📝 **Attribution**: Automatically adds source attribution to synced files

## Commands

### Setup Commands
- `Awesome Copilot: Configure Marketplace` - Set the marketplace to browse from
- `Awesome Copilot: Remove Repository` - Remove a registered marketplace
- `Awesome Copilot: Sync Marketplace` - Pull the latest marketplace index and resources
- `Awesome Copilot: Initialize Project Structure` - Create the basic `.github/` directory structure

### Resource Commands
- `Awesome Copilot: Find and Add Agent` - Discover and install agents
- `Awesome Copilot: Find and Add Prompt` - Discover and install prompts
- `Awesome Copilot: Find and Add Instruction` - Discover and install instructions
- `Awesome Copilot: Find and Add Skill` - Discover and install skills
- `Awesome Copilot: Find and Add Plugin` - Discover and install plugins

## Project Structure

After initialization and syncing, your project will have this structure:

```
your-project/
├── .github/
│   ├── copilot-instructions.md  # Main copilot instructions
│   ├── agents/                  # Specialized copilot agents (.agent.md files)
│   ├── instructions/            # Coding standards (.instructions.md files)
│   ├── prompts/                 # Reusable prompts (.prompt.md files)
│   └── skills/                  # Agent skills folders
└── AGENTS.md                    # Agent instructions for CLI usage
```

## Configuration

The extension can be configured through VS Code settings:

- `awesome-copilot-sync.targetRepository`: Marketplace to browse from (default: "github/awesome-copilot") - aligned with `copilot plugin marketplace`
- `awesome-copilot-sync.branch`: Branch to sync from (default: "main")
- `awesome-copilot-sync.autoSync`: Automatically sync when workspace opens (default: false)
- `awesome-copilot-sync.syncOnSave`: Check for updates when saving copilot files (default: false)

## Usage

1. **Initialize Structure**: Run `Awesome Copilot: Initialize Project Structure` to create the basic directory structure
2. **Configure Marketplace**: Run `Awesome Copilot: Configure Marketplace` to set your marketplace
3. **Find and Add Resources**: Use the `Find and Add *` commands to discover and install agents, prompts, instructions, skills, and plugins from the marketplace

## Compatible Repository Structure

This extension works with repositories that follow the awesome-copilot structure:

```
repository/
├── agents/           # .agent.md files with frontmatter
├── prompts/          # .prompt.md files with frontmatter
├── instructions/     # .instructions.md files with frontmatter
├── skills/           # Skill folders with SKILL.md files
└── collections/      # Collection .yml files (future feature)
```

## File Formats

### Agent Files (.agent.md)
```markdown
---
description: 'Agent description'
model: 'GPT-4.1'
tools: ['tool1', 'tool2']
---

# Agent Name
Agent content...
```

### Prompt Files (.prompt.md)
```markdown
---
agent: 'agent'
description: 'Prompt description'
tools: ['tool1', 'tool2']
---

# Prompt Name
Prompt content...
```

### Instruction Files (.instructions.md)
```markdown
---
description: 'Instruction description'
applyTo: '**/*.ts, **/*.js'
---

# Instructions
Instruction content...
```

## Development

### Building the Extension
```bash
npm install
npm run compile
```

### Running in Development
1. Open this folder in VS Code
2. Press F5 to start debugging - this opens a new Extension Development Host window
3. In the new window, test the extension commands

### Extension Structure
- `package.json` - Extension manifest and configuration
- `src/extension.ts` - Main extension code
- `tsconfig.json` - TypeScript configuration

## Attribution

All synced files automatically include attribution headers pointing to the source repository and specific file location.

## License

This extension is designed to work with awesome-copilot repositories and follows the same open-source principles.