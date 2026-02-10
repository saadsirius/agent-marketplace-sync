import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

interface GitHubFile {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url?: string;
}

interface AgentMetadata {
    name: string;
    filename: string;
    description: string;
    model?: string;
    tools?: string[];
    downloadUrl: string;
}

interface SyncStatus {
    success: boolean;
    files: string[];
    errors: string[];
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Awesome Copilot Sync is now active!');

    // Register commands
    const commands = [
        vscode.commands.registerCommand('awesome-copilot-sync.configure', configureRepository),
        vscode.commands.registerCommand('awesome-copilot-sync.sync', syncAll),
        vscode.commands.registerCommand('awesome-copilot-sync.syncAgents', () => syncResourceType('agents')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncPrompts', () => syncResourceType('prompts')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncInstructions', () => syncResourceType('instructions')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncSkills', () => syncResourceType('skills')),
        vscode.commands.registerCommand('awesome-copilot-sync.initializeStructure', initializeStructure),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddAgent', findAndAddAgent)
    ];

    commands.forEach(command => context.subscriptions.push(command));

    // Auto sync if enabled
    if (vscode.workspace.getConfiguration('awesome-copilot-sync').get('autoSync')) {
        syncAll();
    }
}

async function configureRepository() {
    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const currentRepo = config.get<string>('targetRepository') || 'github/awesome-copilot';
    
    const repository = await vscode.window.showInputBox({
        prompt: 'Enter the repository to sync from (format: owner/repo)',
        value: currentRepo,
        validateInput: (value) => {
            if (!value || !value.includes('/')) {
                return 'Please enter a valid repository format (owner/repo)';
            }
            return null;
        }
    });

    if (repository) {
        const branch = await vscode.window.showInputBox({
            prompt: 'Enter the branch to sync from',
            value: config.get<string>('branch') || 'main'
        });

        if (branch) {
            await config.update('targetRepository', repository, vscode.ConfigurationTarget.Workspace);
            await config.update('branch', branch, vscode.ConfigurationTarget.Workspace);
            
            vscode.window.showInformationMessage(`Configuration updated! Repository: ${repository}, Branch: ${branch}`);
        }
    }
}

async function initializeStructure() {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) return;

    const directories = [
        '.github',
        '.github/agents',
        '.github/instructions', 
        '.github/prompts',
        '.github/skills'
    ];

    try {
        for (const dir of directories) {
            const dirPath = path.join(workspaceFolder, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }

        // Create basic copilot-instructions.md if it doesn't exist
        const instructionsPath = path.join(workspaceFolder, '.github', 'copilot-instructions.md');
        if (!fs.existsSync(instructionsPath)) {
            const template = `# GitHub Copilot Instructions

This file provides instructions to GitHub Copilot for working with this repository.

## Project Overview

<!-- Add project description here -->

## Coding Standards

<!-- Add coding standards and conventions here -->

## Architecture

<!-- Add architectural patterns and decisions here -->
`;
            fs.writeFileSync(instructionsPath, template);
        }

        // Create AGENTS.md if it doesn't exist
        const agentsPath = path.join(workspaceFolder, 'AGENTS.md');
        if (!fs.existsSync(agentsPath)) {
            const template = `# AGENTS.md

## Project Overview

<!-- Add project overview for AI agents -->

## Repository Structure

<!-- Add repository structure description -->

## Development Workflow

<!-- Add development workflow instructions -->
`;
            fs.writeFileSync(agentsPath, template);
        }

        vscode.window.showInformationMessage('Project structure initialized successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize structure: ${error}`);
    }
}

async function syncAll() {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) return;

    const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Syncing Copilot Resources",
        cancellable: true
    }, async (progress, token) => {
        const resourceTypes = ['agents', 'prompts', 'instructions', 'skills'];
        let totalFiles = 0;
        let processedFiles = 0;

        for (let i = 0; i < resourceTypes.length; i++) {
            const resourceType = resourceTypes[i];
            
            if (token.isCancellationRequested) {
                break;
            }

            progress.report({ 
                message: `Syncing ${resourceType}...`,
                increment: (i / resourceTypes.length) * 100
            });

            const result = await syncResourceTypeInternal(resourceType);
            totalFiles += result.files.length;
            processedFiles = totalFiles;
        }

        return { totalFiles, processedFiles };
    });

    if (progress) {
        vscode.window.showInformationMessage(`Sync completed! Processed ${progress.totalFiles} files.`);
    }
}

async function syncResourceType(resourceType: 'agents' | 'prompts' | 'instructions' | 'skills') {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Syncing ${resourceType}`,
        cancellable: false
    }, async () => {
        const result = await syncResourceTypeInternal(resourceType);
        
        if (result.success) {
            vscode.window.showInformationMessage(
                `${resourceType} sync completed! ${result.files.length} files processed.`
            );
        } else {
            vscode.window.showErrorMessage(
                `${resourceType} sync failed: ${result.errors.join(', ')}`
            );
        }
        
        return result;
    });
}

async function syncResourceTypeInternal(resourceType: string): Promise<SyncStatus> {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        return { success: false, files: [], errors: ['No workspace folder found'] };
    }

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const branch = config.get<string>('branch') || 'main';

    try {
        const files = await fetchDirectoryContents(repository, branch, resourceType);
        const syncedFiles: string[] = [];
        const errors: string[] = [];

        // Ensure target directory exists
        const targetDir = path.join(workspaceFolder, '.github', resourceType);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        for (const file of files) {
            try {
                if (file.type === 'file') {
                    const content = await downloadFile(file.download_url!);
                    const localPath = path.join(targetDir, file.name);
                    
                    // Add attribution header to the content
                    const attribution = `<!-- Synced from: https://github.com/${repository}/blob/${branch}/${file.path} -->\n`;
                    const finalContent = attribution + content;
                    
                    fs.writeFileSync(localPath, finalContent);
                    syncedFiles.push(file.name);
                }
            } catch (error) {
                errors.push(`Failed to sync ${file.name}: ${error}`);
            }
        }

        return { 
            success: errors.length === 0, 
            files: syncedFiles, 
            errors 
        };
    } catch (error) {
        return { 
            success: false, 
            files: [], 
            errors: [`Failed to fetch ${resourceType}: ${error}`] 
        };
    }
}

function getWorkspaceFolder(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}

async function fetchDirectoryContents(repository: string, branch: string, path: string): Promise<GitHubFile[]> {
    return new Promise((resolve, reject) => {
        const url = `https://api.github.com/repos/${repository}/contents/${path}?ref=${branch}`;
        
        https.get(url, {
            headers: {
                'User-Agent': 'VSCode-Awesome-Copilot-Sync',
                'Accept': 'application/vnd.github.v3+json'
            }
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const files = JSON.parse(data) as GitHubFile[];
                        resolve(files);
                    } else if (res.statusCode === 404) {
                        // Directory doesn't exist, return empty array
                        resolve([]);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

async function downloadFile(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

async function findAndAddAgent() {
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) return;

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const branch = config.get<string>('branch') || 'main';

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading available agents...",
        cancellable: false
    }, async () => {
        try {
            // Fetch available agents
            const agentFiles = await fetchDirectoryContents(repository, branch, 'agents');
            const agents: AgentMetadata[] = [];

            // Parse agent metadata from each file
            for (const file of agentFiles) {
                if (file.type === 'file' && file.name.endsWith('.agent.md')) {
                    try {
                        const content = await downloadFile(file.download_url!);
                        const metadata = parseAgentMetadata(file.name, content, file.download_url!);
                        agents.push(metadata);
                    } catch (error) {
                        console.warn(`Failed to parse agent ${file.name}:`, error);
                    }
                }
            }

            if (agents.length === 0) {
                vscode.window.showWarningMessage('No agents found in the target repository.');
                return;
            }

            // Show agent picker
            const quickPickItems = agents.map(agent => ({
                label: agent.name,
                description: agent.description,
                detail: `Model: ${agent.model || 'Not specified'} | Tools: ${agent.tools?.join(', ') || 'None'}`,
                agent
            }));

            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: 'Search and select an agent to add to your project...'
            });

            if (selectedItem) {
                await addAgentToProject(selectedItem.agent, workspaceFolder, repository, branch);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load agents: ${error}`);
        }
    });
}

function parseAgentMetadata(filename: string, content: string, downloadUrl: string): AgentMetadata {
    const name = filename.replace('.agent.md', '').replace(/-/g, ' ')
        .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let description = 'No description available';
    let model: string | undefined;
    let tools: string[] | undefined;

    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        
        // Parse description
        const descMatch = frontmatter.match(/description:\s*['"]([^'"]+)['"]/);
        if (descMatch) {
            description = descMatch[1];
        }

        // Parse model
        const modelMatch = frontmatter.match(/model:\s*['"]?([^'"\s]+)['"]?/);
        if (modelMatch) {
            model = modelMatch[1];
        }

        // Parse tools array
        const toolsMatch = frontmatter.match(/tools:\s*\[(.*?)\]/s);
        if (toolsMatch) {
            const toolsStr = toolsMatch[1];
            tools = toolsStr.split(',')
                .map(tool => tool.trim().replace(/['"]/g, ''))
                .filter(tool => tool.length > 0);
        }
    }

    return {
        name,
        filename,
        description,
        model,
        tools,
        downloadUrl
    };
}

async function addAgentToProject(agent: AgentMetadata, workspaceFolder: string, repository: string, branch: string) {
    try {
        // Ensure agents directory exists
        const agentsDir = path.join(workspaceFolder, '.github', 'agents');
        if (!fs.existsSync(agentsDir)) {
            fs.mkdirSync(agentsDir, { recursive: true });
        }

        // Download the agent content
        const content = await downloadFile(agent.downloadUrl);
        
        // Add attribution header
        const attribution = `<!-- Synced from: https://github.com/${repository}/blob/${branch}/agents/${agent.filename} -->\n`;
        const finalContent = attribution + content;

        // Write to local file
        const localPath = path.join(agentsDir, agent.filename);
        fs.writeFileSync(localPath, finalContent);

        // Show success message with option to open the file
        const action = await vscode.window.showInformationMessage(
            `✅ Added agent "${agent.name}" to your project!`,
            'Open File'
        );

        if (action === 'Open File') {
            const document = await vscode.workspace.openTextDocument(localPath);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add agent: ${error}`);
    }
}

export function deactivate() {}