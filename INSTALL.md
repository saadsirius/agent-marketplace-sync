# Installation & Usage Guide

## 🚀 Quick Start

### Option 1: Development Mode (Recommended for testing)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd vscode-awesome-copilot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Compile the extension**:
   ```bash
   npm run compile
   ```

4. **Open in VS Code**:
   ```bash
   code .
   ```

5. **Run in Development Host**:
   - Press `F5` to open a new Extension Development Host window
   - Use commands in the new window to test the extension

### Option 2: Package and Install

1. **Build the VSIX package**:
   ```bash
   npm run package
   ```

2. **Install the VSIX file**:
   - Open VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Extensions: Install from VSIX..."
   - Select the generated `.vsix` file

## 📋 First Time Setup

### Step 1: Initialize Your Project

1. Open your project folder in VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type: `Awesome Copilot: Initialize Project Structure`
4. This creates the basic `.github/` directory structure:

```
your-project/
├── .github/
│   ├── copilot-instructions.md
│   ├── agents/
│   ├── instructions/
│   ├── prompts/
│   └── skills/
└── AGENTS.md
```

### Step 2: Configure Repository

1. Press `Ctrl+Shift+P`
2. Type: `Awesome Copilot: Configure Repository`
3. Enter the repository to sync from (default: `github/awesome-copilot`)
4. Enter the branch to sync from (default: `main`)

**Popular repositories to try**:
- `github/awesome-copilot` - The main community collection
- Your own repository following the same structure

### Step 3: Sync Content

**Option A: Sync Everything**
- Command: `Awesome Copilot: Sync All Resources`
- Downloads all agents, prompts, instructions, and skills

**Option B: Selective Sync**
- `Awesome Copilot: Sync Agents Only` - Chat agents only
- `Awesome Copilot: Sync Prompts Only` - Reusable prompts only
- `Awesome Copilot: Sync Instructions Only` - Coding standards only
- `Awesome Copilot: Sync Skills Only` - Advanced workflows only

## 🔧 Configuration

Access settings via:
- **File > Preferences > Settings** (Windows/Linux)
- **Code > Preferences > Settings** (Mac)
- Search for "Awesome Copilot"

### Available Settings

```json
{
  // Repository to sync from (owner/repo format)
  "awesome-copilot-sync.targetRepository": "github/awesome-copilot",
  
  // Branch to sync from  
  "awesome-copilot-sync.branch": "main",
  
  // Auto-sync when opening workspace
  "awesome-copilot-sync.autoSync": false,
  
  // Check for updates when saving copilot files
  "awesome-copilot-sync.syncOnSave": false
}
```

## 💡 Usage Examples

### Scenario 1: New TypeScript Project

1. Initialize structure
2. Configure to sync from `github/awesome-copilot` 
3. Sync all resources
4. Result: Get TypeScript best practices, testing prompts, and code review agents

### Scenario 2: Custom Company Standards

1. Create your own repository with company coding standards
2. Structure it like: `company/copilot-standards`
3. Configure extension to sync from your repository
4. Share consistent standards across all team projects

### Scenario 3: Specialized Domain

1. Find or create a repository focused on your domain (e.g., machine learning, web dev)
2. Configure to sync from specialized repository
3. Get domain-specific agents and prompts

## 🎯 What Gets Synced

### Agents (Chat Modes)
- **File Pattern**: `.agent.md`
- **Location**: `.github/agents/`  
- **Purpose**: Specialized GitHub Copilot chat modes
- **Example**: Code reviewers, debuggers, architects

### Prompts (Reusable Tasks)
- **File Pattern**: `.prompt.md`
- **Location**: `.github/prompts/`
- **Purpose**: Ready-to-use prompts for common tasks
- **Example**: Test generation, code refactoring, documentation

### Instructions (Coding Standards)
- **File Pattern**: `.instructions.md` 
- **Location**: `.github/instructions/`
- **Purpose**: File-specific coding standards and conventions
- **Example**: TypeScript rules, testing practices, security guidelines

### Skills (Advanced Workflows)
- **File Pattern**: `SKILL.md` in folders
- **Location**: `.github/skills/`
- **Purpose**: Complex multi-step workflows
- **Example**: Deployment processes, Git workflows, CI/CD setup

## 🔍 Verifying Installation

After syncing, check that files have attribution headers:

```markdown
<!-- Synced from: https://github.com/github/awesome-copilot/blob/main/agents/code-reviewer.agent.md -->
---
description: 'Expert code reviewer'
model: 'GPT-4.1'
tools: ['codebase']
---

# Code Reviewer Agent
...
```

## 🐛 Troubleshooting

### Common Issues

**"No workspace folder found"**
- Solution: Open a folder in VS Code before running commands

**"HTTP 404 error"**
- Solution: Check repository name format (owner/repo) and branch name

**"Empty sync results"**  
- Solution: Target repository may not have the expected directory structure

**Files not appearing in Copilot**
- Solution: Restart VS Code after syncing to reload Copilot configuration

### Getting Help

1. **Check the Console**: View > Output > Select "Awesome Copilot Sync"  
2. **Verify Repository Structure**: Ensure target repo follows awesome-copilot format
3. **Test with Default**: Try syncing from `github/awesome-copilot` first
4. **File Issues**: Report problems in the GitHub repository

## 🚀 Advanced Usage

### Creating Your Own Repository

Structure your repository like this:

```
your-copilot-repo/
├── agents/
│   ├── my-agent.agent.md
│   └── another-agent.agent.md
├── prompts/
│   ├── my-prompt.prompt.md
│   └── another-prompt.prompt.md
├── instructions/
│   ├── my-standards.instructions.md
│   └── testing.instructions.md
└── skills/
    ├── my-workflow/
    │   └── SKILL.md
    └── deployment/
        └── SKILL.md
```

Each file needs proper frontmatter - see the examples directory for templates.

### Team Workflows

1. **Create team repository** with your standards
2. **Configure all team members** to sync from team repo 
3. **Update centrally** - changes sync to everyone
4. **Allow customization** - team members can modify synced files locally

Ready to get started? Run `Awesome Copilot: Initialize Project Structure` in your project! 🎉