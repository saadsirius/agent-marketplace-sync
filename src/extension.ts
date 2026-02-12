import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

// Logging utility functions
function logInfo(operation: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] [${operation}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function logError(operation: string, message: string, error?: any) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] [${operation}] ${message}`, error);
}

function logWarn(operation: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] [${operation}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function logDebug(operation: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [DEBUG] [${operation}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function generateOperationId(): string {
    return Math.random().toString(36).substr(2, 9);
}

function createAttributionComment(repository: string, branch: string, resourcePath: string): string {
    return `# Synced from: https://github.com/${repository}/blob/${branch}/${resourcePath}\n`;
}

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

interface PromptMetadata {
    name: string;
    filename: string;
    description: string;
    category?: string;
    tags?: string[];
    downloadUrl: string;
}

interface InstructionMetadata {
    name: string;
    filename: string;
    description: string;
    scope?: string;
    language?: string;
    downloadUrl: string;
}

interface SkillMetadata {
    name: string;
    filename: string;
    description: string;
    domain?: string;
    complexity?: string;
    downloadUrl: string;
}

interface SyncStatus {
    success: boolean;
    files: string[];
    errors: string[];
}

export function activate(context: vscode.ExtensionContext) {
    logInfo('EXTENSION', 'Awesome Copilot Sync extension is activating...');
    
    const extensionVersion = context.extension.packageJSON.version;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    logInfo('EXTENSION', 'Extension details', {
        version: extensionVersion,
        workspaceFolders: workspaceFolders?.length || 0,
        activeWorkspace: workspaceFolders?.[0]?.uri.fsPath
    });

    // Register commands
    const commands = [
        vscode.commands.registerCommand('awesome-copilot-sync.configure', configureRepository),
        vscode.commands.registerCommand('awesome-copilot-sync.sync', syncAll),
        vscode.commands.registerCommand('awesome-copilot-sync.syncAgents', () => syncResourceType('agents')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncPrompts', () => syncResourceType('prompts')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncInstructions', () => syncResourceType('instructions')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncSkills', () => syncResourceType('skills')),
        vscode.commands.registerCommand('awesome-copilot-sync.initializeStructure', initializeStructure),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddAgent', findAndAddAgent),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddPrompt', findAndAddPrompt),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddInstruction', findAndAddInstruction),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddSkill', findAndAddSkill)
    ];

    commands.forEach(command => context.subscriptions.push(command));
    
    logInfo('EXTENSION', 'Registered commands', {
        commandCount: commands.length,
        commands: [
            'configure', 'sync', 'syncAgents', 'syncPrompts', 'syncInstructions', 
            'syncSkills', 'initializeStructure', 'findAndAddAgent', 'findAndAddPrompt', 
            'findAndAddInstruction', 'findAndAddSkill'
        ]
    });

    // Auto sync if enabled
    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const autoSync = config.get('autoSync');
    
    logInfo('EXTENSION', 'Checking auto-sync configuration', { autoSync });
    
    if (autoSync) {
        logInfo('EXTENSION', 'Auto-sync is enabled, starting sync...');
        syncAll();
    } else {
        logInfo('EXTENSION', 'Auto-sync is disabled');
    }
    
    logInfo('EXTENSION', 'Extension activation complete!');
}

async function configureRepository() {
    const operationId = generateOperationId();
    logInfo('CONFIG', 'Starting repository configuration', { operationId });
    
    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const currentRepo = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const currentBranch = config.get<string>('branch') || 'main';
    
    logDebug('CONFIG', 'Current configuration', {
        operationId,
        currentRepo,
        currentBranch
    });
    
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
            try {
                logInfo('CONFIG', 'Updating configuration', { 
                    operationId,
                    repository, 
                    branch 
                });
                
                await config.update('targetRepository', repository, vscode.ConfigurationTarget.Workspace);
                await config.update('branch', branch, vscode.ConfigurationTarget.Workspace);
                
                logInfo('CONFIG', 'Configuration updated successfully', {
                    operationId,
                    repository,
                    branch
                });
                
                vscode.window.showInformationMessage(`Configuration updated! Repository: ${repository}, Branch: ${branch}`);
            } catch (error) {
                logError('CONFIG', 'Failed to update configuration', error);
                vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
            }
        } else {
            logWarn('CONFIG', 'Configuration cancelled - no branch specified', { operationId });
        }
    } else {
        logWarn('CONFIG', 'Configuration cancelled - no repository specified', { operationId });
    }
}

async function initializeStructure() {
    const operationId = generateOperationId();
    logInfo('INIT', 'Starting structure initialization', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('INIT', 'No workspace folder found during initialization', { operationId });
        return;
    }
    
    logDebug('INIT', 'Workspace folder found', { 
        operationId,
        workspaceFolder 
    });

    const directories = [
        '.github',
        '.github/agents',
        '.github/instructions', 
        '.github/prompts',
        '.github/skills'
    ];

    try {
        logDebug('INIT', 'Creating directory structure', {
            operationId,
            directories
        });
        
        for (const dir of directories) {
            const dirPath = path.join(workspaceFolder, dir);
            if (!fs.existsSync(dirPath)) {
                logDebug('INIT', 'Creating directory', { 
                    operationId,
                    directory: dir,
                    fullPath: dirPath 
                });
                fs.mkdirSync(dirPath, { recursive: true });
            } else {
                logDebug('INIT', 'Directory already exists', { 
                    operationId,
                    directory: dir,
                    fullPath: dirPath 
                });
            }
        }

        // Create basic copilot-instructions.md if it doesn't exist
        const instructionsPath = path.join(workspaceFolder, '.github', 'copilot-instructions.md');
        if (!fs.existsSync(instructionsPath)) {
            logDebug('INIT', 'Creating copilot-instructions.md template', { 
                operationId,
                path: instructionsPath 
            });
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
        } else {
            logDebug('INIT', 'copilot-instructions.md already exists', { 
                operationId,
                path: instructionsPath 
            });
        }

        // Create AGENTS.md if it doesn't exist
        const agentsPath = path.join(workspaceFolder, 'AGENTS.md');
        if (!fs.existsSync(agentsPath)) {
            logDebug('INIT', 'Creating AGENTS.md template', { 
                operationId,
                path: agentsPath 
            });
            const template = `# AGENTS.md

## Project Overview

<!-- Add project overview for AI agents -->

## Repository Structure

<!-- Add repository structure description -->

## Development Workflow

<!-- Add development workflow instructions -->
`;
            fs.writeFileSync(agentsPath, template);
        } else {
            logDebug('INIT', 'AGENTS.md already exists', { 
                operationId,
                path: agentsPath 
            });
        }

        logInfo('INIT', 'Project structure initialized successfully', { operationId });
        vscode.window.showInformationMessage('Project structure initialized successfully!');
    } catch (error) {
        logError('INIT', 'Failed to initialize structure', error);
        vscode.window.showErrorMessage(`Failed to initialize structure: ${error}`);
    }
}

async function syncAll() {
    const operationId = generateOperationId();
    logInfo('SYNC_ALL', 'Starting complete sync operation', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('SYNC_ALL', 'No workspace folder found during sync', { operationId });
        return;
    }
    
    logDebug('SYNC_ALL', 'Workspace folder found', { 
        operationId,
        workspaceFolder 
    });

    const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Syncing Copilot Resources",
        cancellable: true
    }, async (progress, token) => {
        const resourceTypes = ['agents', 'prompts', 'instructions', 'skills'];
        let totalFiles = 0;
        let processedFiles = 0;
        
        logDebug('SYNC_ALL', 'Starting progress tracking', {
            operationId,
            resourceTypes,
            totalResourceTypes: resourceTypes.length
        });

        for (let i = 0; i < resourceTypes.length; i++) {
            const resourceType = resourceTypes[i];
            
            if (token.isCancellationRequested) {
                logWarn('SYNC_ALL', 'Sync operation cancelled by user', { 
                    operationId,
                    currentResourceType: resourceType,
                    progress: `${i}/${resourceTypes.length}`
                });
                break;
            }

            logInfo('SYNC_ALL', 'Starting resource type sync', {
                operationId,
                resourceType,
                progress: `${i + 1}/${resourceTypes.length}`
            });

            progress.report({ 
                message: `Syncing ${resourceType}...`,
                increment: (i / resourceTypes.length) * 100
            });

            const result = await syncResourceTypeInternal(resourceType);
            totalFiles += result.files.length;
            processedFiles = totalFiles;
            
            logInfo('SYNC_ALL', 'Resource type sync completed', {
                operationId,
                resourceType,
                filesProcessed: result.files.length,
                success: result.success,
                errors: result.errors
            });
        }

        return { totalFiles, processedFiles };
    });

    if (progress) {
        logInfo('SYNC_ALL', 'Complete sync operation finished', {
            operationId,
            totalFiles: progress.totalFiles,
            processedFiles: progress.processedFiles
        });
        vscode.window.showInformationMessage(`Sync completed! Processed ${progress.totalFiles} files.`);
    } else {
        logWarn('SYNC_ALL', 'Sync operation completed without progress data', { operationId });
    }
}

async function syncResourceType(resourceType: 'agents' | 'prompts' | 'instructions' | 'skills') {
    const operationId = generateOperationId();
    logInfo('SYNC_RESOURCE', 'Starting resource type sync', { 
        operationId,
        resourceType 
    });
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Syncing ${resourceType}`,
        cancellable: false
    }, async () => {
        const result = await syncResourceTypeInternal(resourceType);
        
        logInfo('SYNC_RESOURCE', 'Resource type sync completed', {
            operationId,
            resourceType,
            success: result.success,
            filesCount: result.files.length,
            errorsCount: result.errors.length
        });
        
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
    const operationId = generateOperationId();
    logInfo('SYNC_INTERNAL', 'Starting internal resource sync', { 
        operationId,
        resourceType 
    });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('SYNC_INTERNAL', 'No workspace folder found', { operationId, resourceType });
        return { success: false, files: [], errors: ['No workspace folder found'] };
    }

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const branch = config.get<string>('branch') || 'main';
    
    logDebug('SYNC_INTERNAL', 'Sync configuration', {
        operationId,
        resourceType,
        repository,
        branch,
        workspaceFolder
    });

    try {
        logDebug('SYNC_INTERNAL', 'Fetching directory contents', {
            operationId,
            repository,
            branch,
            resourceType
        });
        
        const files = await fetchDirectoryContents(repository, branch, resourceType);
        const syncedFiles: string[] = [];
        const errors: string[] = [];
        
        logInfo('SYNC_INTERNAL', 'Directory contents fetched', {
            operationId,
            resourceType,
            fileCount: files.length,
            files: files.map(f => ({ name: f.name, type: f.type }))
        });

        // Ensure target directory exists
        const targetDir = path.join(workspaceFolder, '.github', resourceType);
        if (!fs.existsSync(targetDir)) {
            logDebug('SYNC_INTERNAL', 'Creating target directory', {
                operationId,
                targetDir
            });
            fs.mkdirSync(targetDir, { recursive: true });
        } else {
            logDebug('SYNC_INTERNAL', 'Target directory already exists', {
                operationId,
                targetDir
            });
        }

        for (const file of files) {
            try {
                if (file.type === 'file') {
                    const content = await downloadFile(file.download_url!);
                    const localPath = path.join(targetDir, file.name);
                    
                    // Add attribution header to the content
                    const attribution = createAttributionComment(repository, branch, file.path);
                    const finalContent = attribution + content;
                    
                    fs.writeFileSync(localPath, finalContent);
                    syncedFiles.push(file.name);
                }
            } catch (error) {
                errors.push(`Failed to sync ${file.name}: ${error}`);
            }
        }

        const result = { 
            success: errors.length === 0, 
            files: syncedFiles, 
            errors 
        };
        
        logInfo('SYNC_INTERNAL', 'Resource sync completed', {
            operationId,
            resourceType,
            result
        });
        
        return result;
    } catch (error) {
        const errorMsg = `Failed to fetch ${resourceType}: ${error}`;
        logError('SYNC_INTERNAL', errorMsg, error);
        return { 
            success: false, 
            files: [], 
            errors: [errorMsg] 
        };
    }
}

function getWorkspaceFolder(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    logDebug('WORKSPACE', 'Checking workspace folders', {
        workspaceFoldersCount: workspaceFolders?.length || 0,
        workspaceFolders: workspaceFolders?.map(f => f.uri.fsPath)
    });
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
        logError('WORKSPACE', 'No workspace folder found');
        vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return undefined;
    }
    
    const workspaceFolder = workspaceFolders[0].uri.fsPath;
    logDebug('WORKSPACE', 'Using workspace folder', { workspaceFolder });
    
    return workspaceFolder;
}

async function fetchDirectoryContents(repository: string, branch: string, path: string): Promise<GitHubFile[]> {
    const operationId = generateOperationId();
    const url = `https://api.github.com/repos/${repository}/contents/${path}?ref=${branch}`;
    
    logInfo('API', 'Fetching directory contents from GitHub API', {
        operationId,
        repository,
        branch,
        path,
        url
    });
    
    return new Promise((resolve, reject) => {
        
        const requestHeaders = {
            'User-Agent': 'VSCode-Awesome-Copilot-Sync',
            'Accept': 'application/vnd.github.v3+json'
        };
        
        logDebug('API', 'Making GitHub API request', {
            operationId,
            headers: requestHeaders
        });
        
        https.get(url, {
            headers: requestHeaders
        }, (res) => {
            let data = '';
            
            logDebug('API', 'Received response', {
                operationId,
                statusCode: res.statusCode,
                headers: res.headers
            });
            
            res.on('data', (chunk) => {
                data += chunk;
                logDebug('API', 'Receiving data chunk', {
                    operationId,
                    chunkSize: chunk.length,
                    totalSize: data.length
                });
            });
            
            res.on('end', () => {
                try {
                    logDebug('API', 'Response complete', {
                        operationId,
                        statusCode: res.statusCode,
                        responseSize: data.length
                    });
                    
                    if (res.statusCode === 200) {
                        const files = JSON.parse(data) as GitHubFile[];
                        logInfo('API', 'Successfully parsed directory contents', {
                            operationId,
                            fileCount: files.length,
                            files: files.map(f => ({ name: f.name, type: f.type }))
                        });
                        resolve(files);
                    } else if (res.statusCode === 404) {
                        // Directory doesn't exist, return empty array
                        logWarn('API', 'Directory not found, returning empty array', {
                            operationId,
                            repository,
                            branch,
                            path
                        });
                        resolve([]);
                    } else {
                        const errorMsg = `HTTP ${res.statusCode}: ${data}`;
                        logError('API', 'API request failed', {
                            operationId,
                            statusCode: res.statusCode,
                            response: data
                        });
                        reject(new Error(errorMsg));
                    }
                } catch (error) {
                    logError('API', 'Failed to parse API response', {
                        operationId,
                        error,
                        rawData: data.substring(0, 500) + (data.length > 500 ? '...' : '')
                    });
                    reject(error);
                }
            });
        }).on('error', (error) => {
            logError('API', 'HTTP request error', {
                operationId,
                error,
                url
            });
            reject(error);
        });
    });
}

async function downloadFile(url: string): Promise<string> {
    const operationId = generateOperationId();
    
    logDebug('DOWNLOAD', 'Starting file download', {
        operationId,
        url
    });
    
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            
            logDebug('DOWNLOAD', 'Download response received', {
                operationId,
                statusCode: res.statusCode,
                contentType: res.headers['content-type'],
                contentLength: res.headers['content-length']
            });
            
            res.on('data', (chunk) => {
                data += chunk;
                logDebug('DOWNLOAD', 'Receiving download chunk', {
                    operationId,
                    chunkSize: chunk.length,
                    totalDownloaded: data.length
                });
            });
            
            res.on('end', () => {
                logDebug('DOWNLOAD', 'Download complete', {
                    operationId,
                    statusCode: res.statusCode,
                    finalSize: data.length
                });
                
                if (res.statusCode === 200) {
                    logInfo('DOWNLOAD', 'File downloaded successfully', {
                        operationId,
                        url,
                        size: data.length
                    });
                    resolve(data);
                } else {
                    const errorMsg = `HTTP ${res.statusCode}`;
                    logError('DOWNLOAD', 'Download failed', {
                        operationId,
                        url,
                        statusCode: res.statusCode
                    });
                    reject(new Error(errorMsg));
                }
            });
        }).on('error', (error) => {
            logError('DOWNLOAD', 'Download request error', {
                operationId,
                url,
                error
            });
            reject(error);
        });
    });
}

async function findAndAddAgent() {
    const operationId = generateOperationId();
    logInfo('FIND_AGENT', 'Starting find and add agent operation', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('FIND_AGENT', 'No workspace folder found', { operationId });
        return;
    }

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const branch = config.get<string>('branch') || 'main';
    
    logDebug('FIND_AGENT', 'Configuration loaded', {
        operationId,
        repository,
        branch,
        workspaceFolder
    });

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
                        logWarn('FIND_AGENT', 'Failed to parse agent metadata', {
                            operationId,
                            fileName: file.name,
                            error
                        });
                    }
                }
            }

            if (agents.length === 0) {
                logWarn('FIND_AGENT', 'No agents found in repository', {
                    operationId,
                    repository,
                    branch
                });
                vscode.window.showWarningMessage('No agents found in the target repository.');
                return;
            }
            
            logInfo('FIND_AGENT', 'Agents loaded successfully', {
                operationId,
                agentCount: agents.length,
                agents: agents.map(a => ({ name: a.name, model: a.model }))
            });

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
                logInfo('FIND_AGENT', 'Agent selected by user', {
                    operationId,
                    selectedAgent: selectedItem.agent.name
                });
                await addAgentToProject(selectedItem.agent, workspaceFolder, repository, branch);
            } else {
                logWarn('FIND_AGENT', 'No agent selected by user', { operationId });
            }
        } catch (error) {
            logError('FIND_AGENT', 'Failed to load agents', { operationId, error });
            vscode.window.showErrorMessage(`Failed to load agents: ${error}`);
        }
    });
}

function parseAgentMetadata(filename: string, content: string, downloadUrl: string): AgentMetadata {
    const operationId = generateOperationId();
    logDebug('PARSE_AGENT', 'Starting agent metadata parsing', {
        operationId,
        filename,
        contentLength: content.length,
        downloadUrl
    });
    
    const name = filename.replace('.agent.md', '').replace(/-/g, ' ')
        .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    logDebug('PARSE_AGENT', 'Generated agent name', {
        operationId,
        filename,
        generatedName: name
    });
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let description = 'No description available';
    let model: string | undefined;
    let tools: string[] | undefined;

    logDebug('PARSE_AGENT', 'Frontmatter extraction', {
        operationId,
        hasFrontmatter: !!frontmatterMatch,
        frontmatterLength: frontmatterMatch ? frontmatterMatch[1].length : 0
    });

    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        
        logDebug('PARSE_AGENT', 'Processing frontmatter', {
            operationId,
            frontmatter: frontmatter.substring(0, 200) + (frontmatter.length > 200 ? '...' : '')
        });
        
        // Parse description
        const descMatch = frontmatter.match(/description:\s*['"]([^'"]+)['"]/);
        if (descMatch) {
            description = descMatch[1];
            logDebug('PARSE_AGENT', 'Description parsed', {
                operationId,
                description
            });
        }

        // Parse model
        const modelMatch = frontmatter.match(/model:\s*['"]?([^'"\s]+)['"]?/);
        if (modelMatch) {
            model = modelMatch[1];
            logDebug('PARSE_AGENT', 'Model parsed', {
                operationId,
                model
            });
        }

        // Parse tools array
        const toolsMatch = frontmatter.match(/tools:\s*\[(.*?)\]/s);
        if (toolsMatch) {
            const toolsStr = toolsMatch[1];
            tools = toolsStr.split(',')
                .map(tool => tool.trim().replace(/['"]/g, ''))
                .filter(tool => tool.length > 0);
            logDebug('PARSE_AGENT', 'Tools parsed', {
                operationId,
                tools,
                toolsCount: tools.length
            });
        }
    } else {
        logWarn('PARSE_AGENT', 'No frontmatter found in agent file', {
            operationId,
            filename
        });
    }

    const result = {
        name,
        filename,
        description,
        model,
        tools,
        downloadUrl
    };
    
    logInfo('PARSE_AGENT', 'Agent metadata parsing completed', {
        operationId,
        result
    });
    
    return result;
}

async function addAgentToProject(agent: AgentMetadata, workspaceFolder: string, repository: string, branch: string) {
    const operationId = generateOperationId();
    logInfo('ADD_AGENT', 'Starting add agent to project', {
        operationId,
        agentName: agent.name,
        filename: agent.filename,
        repository,
        branch
    });
    
    try {
        // Ensure agents directory exists
        const agentsDir = path.join(workspaceFolder, '.github', 'agents');
        if (!fs.existsSync(agentsDir)) {
            logDebug('ADD_AGENT', 'Creating agents directory', {
                operationId,
                agentsDir
            });
            fs.mkdirSync(agentsDir, { recursive: true });
        } else {
            logDebug('ADD_AGENT', 'Agents directory already exists', {
                operationId,
                agentsDir
            });
        }

        // Download the agent content
        logDebug('ADD_AGENT', 'Downloading agent content', {
            operationId,
            downloadUrl: agent.downloadUrl
        });
        
        const content = await downloadFile(agent.downloadUrl);
        
        // Add attribution header
        const attribution = createAttributionComment(repository, branch, `agents/${agent.filename}`);
        const finalContent = attribution + content;

        // Write to local file
        const localPath = path.join(agentsDir, agent.filename);
        fs.writeFileSync(localPath, finalContent);
        
        logInfo('ADD_AGENT', 'Agent file written successfully', {
            operationId,
            localPath,
            contentLength: finalContent.length
        });

        // Show success message with option to open the file
        const action = await vscode.window.showInformationMessage(
            `✅ Added agent "${agent.name}" to your project!`,
            'Open File'
        );

        logInfo('ADD_AGENT', 'User notification shown', {
            operationId,
            userAction: action
        });

        if (action === 'Open File') {
            logDebug('ADD_AGENT', 'Opening agent file for user', {
                operationId,
                localPath
            });
            const document = await vscode.workspace.openTextDocument(localPath);
            await vscode.window.showTextDocument(document);
        }
        
        logInfo('ADD_AGENT', 'Add agent to project completed successfully', { operationId });
    } catch (error) {
        logError('ADD_AGENT', 'Failed to add agent to project', { operationId, error });
        vscode.window.showErrorMessage(`Failed to add agent: ${error}`);
    }
}

function parsePromptMetadata(filename: string, content: string, downloadUrl: string): PromptMetadata {
    const operationId = generateOperationId();
    logDebug('PARSE_PROMPT', 'Starting prompt metadata parsing', {
        operationId,
        filename,
        contentLength: content.length
    });
    
    const name = filename.replace('.prompt.md', '').replace(/-/g, ' ')
        .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let description = 'No description available';
    let category: string | undefined;
    let tags: string[] | undefined;

    logDebug('PARSE_PROMPT', 'Frontmatter extraction result', {
        operationId,
        hasFrontmatter: !!frontmatterMatch
    });

    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        
        // Parse description
        const descMatch = frontmatter.match(/description:\s*['"]([^'"]+)['"]/);
        if (descMatch) {
            description = descMatch[1];
        }

        // Parse category
        const categoryMatch = frontmatter.match(/category:\s*['"]?([^'"\s]+)['"]?/);
        if (categoryMatch) {
            category = categoryMatch[1];
        }

        // Parse tags array
        const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/s);
        if (tagsMatch) {
            const tagsStr = tagsMatch[1];
            tags = tagsStr.split(',')
                .map(tag => tag.trim().replace(/['"]/, ''))
                .filter(tag => tag.length > 0);
        }
        
        logDebug('PARSE_PROMPT', 'Parsed prompt metadata', {
            operationId,
            description,
            category,
            tags
        });
    }

    const result = {
        name,
        filename,
        description,
        category,
        tags,
        downloadUrl
    };
    
    logInfo('PARSE_PROMPT', 'Prompt metadata parsing completed', {
        operationId,
        result
    });
    
    return result;
}

function parseInstructionMetadata(filename: string, content: string, downloadUrl: string): InstructionMetadata {
    const operationId = generateOperationId();
    logDebug('PARSE_INSTRUCTION', 'Starting instruction metadata parsing', {
        operationId,
        filename,
        contentLength: content.length
    });
    
    const name = filename.replace('.instructions.md', '').replace(/-/g, ' ')
        .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let description = 'No description available';
    let scope: string | undefined;
    let language: string | undefined;

    logDebug('PARSE_INSTRUCTION', 'Frontmatter extraction result', {
        operationId,
        hasFrontmatter: !!frontmatterMatch
    });

    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        
        // Parse description
        const descMatch = frontmatter.match(/description:\s*['"]([^'"]+)['"]/);
        if (descMatch) {
            description = descMatch[1];
        }

        // Parse scope
        const scopeMatch = frontmatter.match(/scope:\s*['"]?([^'"\s]+)['"]?/);
        if (scopeMatch) {
            scope = scopeMatch[1];
        }

        // Parse language
        const languageMatch = frontmatter.match(/language:\s*['"]?([^'"\s]+)['"]?/);
        if (languageMatch) {
            language = languageMatch[1];
        }
        
        logDebug('PARSE_INSTRUCTION', 'Parsed instruction metadata', {
            operationId,
            description,
            scope,
            language
        });
    }

    const result = {
        name,
        filename,
        description,
        scope,
        language,
        downloadUrl
    };
    
    logInfo('PARSE_INSTRUCTION', 'Instruction metadata parsing completed', {
        operationId,
        result
    });
    
    return result;
}

function parseSkillMetadata(filename: string, content: string, downloadUrl: string): SkillMetadata {
    const name = filename.replace('.skill.md', '').replace(/-/g, ' ')
        .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let description = 'No description available';
    let domain: string | undefined;
    let complexity: string | undefined;

    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        
        // Parse description
        const descMatch = frontmatter.match(/description:\s*['"]([^'"]+)['"]/);
        if (descMatch) {
            description = descMatch[1];
        }

        // Parse domain
        const domainMatch = frontmatter.match(/domain:\s*['"]?([^'"\s]+)['"]?/);
        if (domainMatch) {
            domain = domainMatch[1];
        }

        // Parse complexity
        const complexityMatch = frontmatter.match(/complexity:\s*['"]?([^'"\s]+)['"]?/);
        if (complexityMatch) {
            complexity = complexityMatch[1];
        }
    }

    return {
        name,
        filename,
        description,
        domain,
        complexity,
        downloadUrl
    };
}

async function addPromptToProject(prompt: PromptMetadata, workspaceFolder: string, repository: string, branch: string) {
    try {
        // Ensure prompts directory exists
        const promptsDir = path.join(workspaceFolder, '.github', 'prompts');
        if (!fs.existsSync(promptsDir)) {
            fs.mkdirSync(promptsDir, { recursive: true });
        }

        // Download the prompt content
        const content = await downloadFile(prompt.downloadUrl);
        
        // Add attribution header
        const attribution = createAttributionComment(repository, branch, `prompts/${prompt.filename}`);
        const finalContent = attribution + content;

        // Write to local file
        const localPath = path.join(promptsDir, prompt.filename);
        fs.writeFileSync(localPath, finalContent);

        // Show success message with option to open the file
        const action = await vscode.window.showInformationMessage(
            `✅ Added prompt "${prompt.name}" to your project!`,
            'Open File'
        );

        if (action === 'Open File') {
            const document = await vscode.workspace.openTextDocument(localPath);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add prompt: ${error}`);
    }
}

async function addInstructionToProject(instruction: InstructionMetadata, workspaceFolder: string, repository: string, branch: string) {
    try {
        // Ensure instructions directory exists
        const instructionsDir = path.join(workspaceFolder, '.github', 'instructions');
        if (!fs.existsSync(instructionsDir)) {
            fs.mkdirSync(instructionsDir, { recursive: true });
        }

        // Download the instruction content
        const content = await downloadFile(instruction.downloadUrl);
        
        // Add attribution header
        const attribution = createAttributionComment(repository, branch, `instructions/${instruction.filename}`);
        const finalContent = attribution + content;

        // Write to local file
        const localPath = path.join(instructionsDir, instruction.filename);
        fs.writeFileSync(localPath, finalContent);

        // Show success message with option to open the file
        const action = await vscode.window.showInformationMessage(
            `✅ Added instruction "${instruction.name}" to your project!`,
            'Open File'
        );

        if (action === 'Open File') {
            const document = await vscode.workspace.openTextDocument(localPath);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add instruction: ${error}`);
    }
}

async function addSkillToProject(skill: SkillMetadata, workspaceFolder: string, repository: string, branch: string) {
    try {
        // Ensure skills directory exists
        const skillsDir = path.join(workspaceFolder, '.github', 'skills');
        if (!fs.existsSync(skillsDir)) {
            fs.mkdirSync(skillsDir, { recursive: true });
        }

        // Download the skill content
        const content = await downloadFile(skill.downloadUrl);
        
        // Add attribution header
        const attribution = createAttributionComment(repository, branch, `skills/${skill.filename}`);
        const finalContent = attribution + content;

        // Write to local file
        const localPath = path.join(skillsDir, skill.filename);
        fs.writeFileSync(localPath, finalContent);

        // Show success message with option to open the file
        const action = await vscode.window.showInformationMessage(
            `✅ Added skill "${skill.name}" to your project!`,
            'Open File'
        );

        if (action === 'Open File') {
            const document = await vscode.workspace.openTextDocument(localPath);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add skill: ${error}`);
    }
}

async function findAndAddPrompt() {
    const operationId = generateOperationId();
    logInfo('FIND_PROMPT', 'Starting find and add prompt operation', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('FIND_PROMPT', 'No workspace folder found', { operationId });
        return;
    }

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const branch = config.get<string>('branch') || 'main';

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading available prompts...",
        cancellable: false
    }, async () => {
        try {
            // Fetch available prompts
            const promptFiles = await fetchDirectoryContents(repository, branch, 'prompts');
            const prompts: PromptMetadata[] = [];

            // Parse prompt metadata from each file
            for (const file of promptFiles) {
                if (file.type === 'file' && file.name.endsWith('.prompt.md')) {
                    try {
                        const content = await downloadFile(file.download_url!);
                        const metadata = parsePromptMetadata(file.name, content, file.download_url!);
                        prompts.push(metadata);
                    } catch (error) {
                        logWarn('FIND_PROMPT', 'Failed to parse prompt metadata', {
                            operationId,
                            fileName: file.name,
                            error
                        });
                    }
                }
            }

            if (prompts.length === 0) {
                vscode.window.showWarningMessage('No prompts found in the target repository.');
                return;
            }

            // Show prompt picker
            const quickPickItems = prompts.map(prompt => ({
                label: prompt.name,
                description: prompt.description,
                detail: `Category: ${prompt.category || 'Not specified'} | Tags: ${prompt.tags?.join(', ') || 'None'}`,
                prompt
            }));

            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: 'Search and select a prompt to add to your project...'
            });

            if (selectedItem) {
                await addPromptToProject(selectedItem.prompt, workspaceFolder, repository, branch);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load prompts: ${error}`);
        }
    });
}

async function findAndAddInstruction() {
    const operationId = generateOperationId();
    logInfo('FIND_INSTRUCTION', 'Starting find and add instruction operation', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('FIND_INSTRUCTION', 'No workspace folder found', { operationId });
        return;
    }

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const branch = config.get<string>('branch') || 'main';

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading available instructions...",
        cancellable: false
    }, async () => {
        try {
            // Fetch available instructions
            const instructionFiles = await fetchDirectoryContents(repository, branch, 'instructions');
            const instructions: InstructionMetadata[] = [];

            // Parse instruction metadata from each file
            for (const file of instructionFiles) {
                if (file.type === 'file' && file.name.endsWith('.instructions.md')) {
                    try {
                        const content = await downloadFile(file.download_url!);
                        const metadata = parseInstructionMetadata(file.name, content, file.download_url!);
                        instructions.push(metadata);
                    } catch (error) {
                        logWarn('FIND_INSTRUCTION', 'Failed to parse instruction metadata', {
                            operationId,
                            fileName: file.name,
                            error
                        });
                    }
                }
            }

            if (instructions.length === 0) {
                vscode.window.showWarningMessage('No instructions found in the target repository.');
                return;
            }

            // Show instruction picker
            const quickPickItems = instructions.map(instruction => ({
                label: instruction.name,
                description: instruction.description,
                detail: `Scope: ${instruction.scope || 'Not specified'} | Language: ${instruction.language || 'All'}`,
                instruction
            }));

            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: 'Search and select an instruction to add to your project...'
            });

            if (selectedItem) {
                await addInstructionToProject(selectedItem.instruction, workspaceFolder, repository, branch);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load instructions: ${error}`);
        }
    });
}

async function findAndAddSkill() {
    const operationId = generateOperationId();
    logInfo('FIND_SKILL', 'Starting find and add skill operation', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('FIND_SKILL', 'No workspace folder found', { operationId });
        return;
    }

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
    const branch = config.get<string>('branch') || 'main';

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Loading available skills...",
        cancellable: false
    }, async () => {
        try {
            // Fetch available skills
            const skillFiles = await fetchDirectoryContents(repository, branch, 'skills');
            const skills: SkillMetadata[] = [];

            // Parse skill metadata from each file
            for (const file of skillFiles) {
                if (file.type === 'file' && file.name.endsWith('.skill.md')) {
                    try {
                        const content = await downloadFile(file.download_url!);
                        const metadata = parseSkillMetadata(file.name, content, file.download_url!);
                        skills.push(metadata);
                    } catch (error) {
                        logWarn('FIND_SKILL', 'Failed to parse skill metadata', {
                            operationId,
                            fileName: file.name,
                            error
                        });
                    }
                }
            }

            if (skills.length === 0) {
                vscode.window.showWarningMessage('No skills found in the target repository.');
                return;
            }

            // Show skill picker
            const quickPickItems = skills.map(skill => ({
                label: skill.name,
                description: skill.description,
                detail: `Domain: ${skill.domain || 'Not specified'} | Complexity: ${skill.complexity || 'Not specified'}`,
                skill
            }));

            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: 'Search and select a skill to add to your project...'
            });

            if (selectedItem) {
                await addSkillToProject(selectedItem.skill, workspaceFolder, repository, branch);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load skills: ${error}`);
        }
    });
}

export function deactivate() {
    logInfo('EXTENSION', 'Extension is being deactivated');
}