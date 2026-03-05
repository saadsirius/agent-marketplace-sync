import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';

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

// Cache system for repository data
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface RepositoryCache {
    [key: string]: CacheEntry<any>;
}

class RepositoryDataCache {
    private cache: RepositoryCache = {};
    private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    private generateCacheKey(repository: string, branch: string, resourceType: string): string {
        return `${repository}:${branch}:${resourceType}`;
    }

    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    get<T>(repository: string, branch: string, resourceType: string): T | null {
        const key = this.generateCacheKey(repository, branch, resourceType);
        const entry = this.cache[key];
        
        if (!entry) {
            return null;
        }
        
        if (this.isExpired(entry)) {
            delete this.cache[key];
            return null;
        }
        
        logDebug('CACHE', 'Cache hit', { key, age: Date.now() - entry.timestamp });
        return entry.data;
    }

    set<T>(repository: string, branch: string, resourceType: string, data: T, ttl?: number): void {
        const key = this.generateCacheKey(repository, branch, resourceType);
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttl || this.DEFAULT_TTL
        };
        
        this.cache[key] = entry;
        logDebug('CACHE', 'Data cached', { key, dataSize: JSON.stringify(data).length });
    }

    clear(): void {
        this.cache = {};
        logInfo('CACHE', 'Cache cleared');
    }

    getStats(): { entries: number; totalSize: number } {
        const entries = Object.keys(this.cache).length;
        const totalSize = JSON.stringify(this.cache).length;
        return { entries, totalSize };
    }
}

// Global cache instance
const repositoryCache = new RepositoryDataCache();

// Cached metadata fetching functions
async function getCachedAgentMetadata(repository: string, branch: string): Promise<AgentMetadata[]> {
    const cacheKey = 'parsed-agents';
    const cached = repositoryCache.get<AgentMetadata[]>(repository, branch, cacheKey);
    if (cached) {
        logInfo('METADATA_CACHE', 'Using cached agent metadata', { count: cached.length });
        return cached;
    }

    const agents: AgentMetadata[] = [];
    const localBase = getLocalCachePath(repository);

    if (localBase) {
        logInfo('METADATA_CACHE', 'Reading agent metadata from local CLI cache', { localBase });
        const agentsDir = path.join(localBase, 'agents');
        if (fs.existsSync(agentsDir)) {
            for (const file of fs.readdirSync(agentsDir).filter(f => f.endsWith('.agent.md'))) {
                try {
                    const localPath = path.join(agentsDir, file);
                    const content = fs.readFileSync(localPath, 'utf8');
                    const downloadUrl = `https://raw.githubusercontent.com/${repository}/${branch}/agents/${file}`;
                    const metadata = parseAgentMetadata(file, content, downloadUrl);
                    metadata.localPath = localPath;
                    agents.push(metadata);
                } catch (error) {
                    logWarn('METADATA_CACHE', 'Failed to parse local agent', { file, error });
                }
            }
        }
    } else {
        logInfo('METADATA_CACHE', 'Fetching agent metadata from GitHub API');
        const agentFiles = await fetchDirectoryContents(repository, branch, 'agents');
        for (const file of agentFiles) {
            if (file.type === 'file' && file.name.endsWith('.agent.md')) {
                try {
                    const content = await downloadFile(file.download_url!);
                    agents.push(parseAgentMetadata(file.name, content, file.download_url!));
                } catch (error) {
                    logWarn('METADATA_CACHE', 'Failed to parse agent metadata', { fileName: file.name, error });
                }
            }
        }
    }

    repositoryCache.set(repository, branch, cacheKey, agents);
    logInfo('METADATA_CACHE', 'Agent metadata cached', { count: agents.length });
    return agents;
}

async function getCachedPromptMetadata(repository: string, branch: string): Promise<PromptMetadata[]> {
    const cacheKey = 'parsed-prompts';
    const cached = repositoryCache.get<PromptMetadata[]>(repository, branch, cacheKey);
    if (cached) {
        logInfo('METADATA_CACHE', 'Using cached prompt metadata', { count: cached.length });
        return cached;
    }

    const prompts: PromptMetadata[] = [];
    const localBase = getLocalCachePath(repository);

    if (localBase) {
        logInfo('METADATA_CACHE', 'Reading prompt metadata from local CLI cache', { localBase });
        const promptsDir = path.join(localBase, 'prompts');
        if (fs.existsSync(promptsDir)) {
            for (const file of fs.readdirSync(promptsDir).filter(f => f.endsWith('.prompt.md'))) {
                try {
                    const localPath = path.join(promptsDir, file);
                    const content = fs.readFileSync(localPath, 'utf8');
                    const downloadUrl = `https://raw.githubusercontent.com/${repository}/${branch}/prompts/${file}`;
                    const metadata = parsePromptMetadata(file, content, downloadUrl);
                    metadata.localPath = localPath;
                    prompts.push(metadata);
                } catch (error) {
                    logWarn('METADATA_CACHE', 'Failed to parse local prompt', { file, error });
                }
            }
        }
    } else {
        logInfo('METADATA_CACHE', 'Fetching prompt metadata from GitHub API');
        const promptFiles = await fetchDirectoryContents(repository, branch, 'prompts');
        for (const file of promptFiles) {
            if (file.type === 'file' && file.name.endsWith('.prompt.md')) {
                try {
                    const content = await downloadFile(file.download_url!);
                    prompts.push(parsePromptMetadata(file.name, content, file.download_url!));
                } catch (error) {
                    logWarn('METADATA_CACHE', 'Failed to parse prompt metadata', { fileName: file.name, error });
                }
            }
        }
    }

    repositoryCache.set(repository, branch, cacheKey, prompts);
    logInfo('METADATA_CACHE', 'Prompt metadata cached', { count: prompts.length });
    return prompts;
}

async function getCachedInstructionMetadata(repository: string, branch: string): Promise<InstructionMetadata[]> {
    const cacheKey = 'parsed-instructions';
    const cached = repositoryCache.get<InstructionMetadata[]>(repository, branch, cacheKey);
    if (cached) {
        logInfo('METADATA_CACHE', 'Using cached instruction metadata', { count: cached.length });
        return cached;
    }

    const instructions: InstructionMetadata[] = [];
    const localBase = getLocalCachePath(repository);

    if (localBase) {
        logInfo('METADATA_CACHE', 'Reading instruction metadata from local CLI cache', { localBase });
        const instructionsDir = path.join(localBase, 'instructions');
        if (fs.existsSync(instructionsDir)) {
            for (const file of fs.readdirSync(instructionsDir).filter(f => f.endsWith('.instructions.md'))) {
                try {
                    const localPath = path.join(instructionsDir, file);
                    const content = fs.readFileSync(localPath, 'utf8');
                    const downloadUrl = `https://raw.githubusercontent.com/${repository}/${branch}/instructions/${file}`;
                    const metadata = parseInstructionMetadata(file, content, downloadUrl);
                    metadata.localPath = localPath;
                    instructions.push(metadata);
                } catch (error) {
                    logWarn('METADATA_CACHE', 'Failed to parse local instruction', { file, error });
                }
            }
        }
    } else {
        logInfo('METADATA_CACHE', 'Fetching instruction metadata from GitHub API');
        const instructionFiles = await fetchDirectoryContents(repository, branch, 'instructions');
        for (const file of instructionFiles) {
            if (file.type === 'file' && file.name.endsWith('.instructions.md')) {
                try {
                    const content = await downloadFile(file.download_url!);
                    instructions.push(parseInstructionMetadata(file.name, content, file.download_url!));
                } catch (error) {
                    logWarn('METADATA_CACHE', 'Failed to parse instruction metadata', { fileName: file.name, error });
                }
            }
        }
    }

    repositoryCache.set(repository, branch, cacheKey, instructions);
    logInfo('METADATA_CACHE', 'Instruction metadata cached', { count: instructions.length });
    return instructions;
}

async function getCachedSkillMetadata(repository: string, branch: string): Promise<SkillMetadata[]> {
    const cacheKey = 'parsed-skills';
    const cached = repositoryCache.get<SkillMetadata[]>(repository, branch, cacheKey);
    if (cached) {
        logInfo('METADATA_CACHE', 'Using cached skill metadata', { count: cached.length });
        return cached;
    }

    const skills: SkillMetadata[] = [];
    const localBase = getLocalCachePath(repository);

    if (localBase) {
        logInfo('METADATA_CACHE', 'Reading skill metadata from local CLI cache', { localBase });
        const skillsDir = path.join(localBase, 'skills');
        if (fs.existsSync(skillsDir)) {
            for (const folderName of fs.readdirSync(skillsDir)) {
                const skillFolder = path.join(skillsDir, folderName);
                const skillMdPath = path.join(skillFolder, 'SKILL.md');
                if (!fs.statSync(skillFolder).isDirectory() || !fs.existsSync(skillMdPath)) { continue; }
                try {
                    const content = fs.readFileSync(skillMdPath, 'utf8');
                    const downloadUrl = `https://raw.githubusercontent.com/${repository}/${branch}/skills/${folderName}/SKILL.md`;
                    const metadata = parseSkillMetadata(folderName, content, downloadUrl);
                    metadata.localPath = skillFolder;
                    skills.push(metadata);
                } catch (error) {
                    logWarn('METADATA_CACHE', 'Failed to parse local skill', { folderName, error });
                }
            }
        }
    } else {
        logInfo('METADATA_CACHE', 'Fetching skill metadata from GitHub API');
        const skillDirs = await fetchDirectoryContents(repository, branch, 'skills');
        for (const dir of skillDirs) {
            if (dir.type !== 'dir') { continue; }
            try {
                const skillMdUrl = `https://raw.githubusercontent.com/${repository}/${branch}/skills/${dir.name}/SKILL.md`;
                const content = await downloadFile(skillMdUrl);
                skills.push(parseSkillMetadata(dir.name, content, skillMdUrl));
            } catch (error) {
                logWarn('METADATA_CACHE', 'Failed to parse skill metadata', { folderName: dir.name, error });
            }
        }
    }

    repositoryCache.set(repository, branch, cacheKey, skills);
    logInfo('METADATA_CACHE', 'Skill metadata cached', { count: skills.length });
    return skills;
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
    localPath?: string;
}

interface PromptMetadata {
    name: string;
    filename: string;
    description: string;
    category?: string;
    tags?: string[];
    downloadUrl: string;
    localPath?: string;
}

interface InstructionMetadata {
    name: string;
    filename: string;
    description: string;
    scope?: string;
    language?: string;
    downloadUrl: string;
    localPath?: string;
}

interface SkillMetadata {
    name: string;
    filename: string;
    description: string;
    domain?: string;
    complexity?: string;
    downloadUrl: string;
    localPath?: string;
}

interface SyncStatus {
    success: boolean;
    files: string[];
    errors: string[];
}

interface RepositoryConfig {
    label: string;
    repository: string;
    branch: string;
}

/**
 * Returns the local disk cache directory for a repository, creating it if it doesn't exist.
 * Maps "github/awesome-copilot" → "~/.copilot/marketplace-cache/github-awesome-copilot".
 */
function getLocalCacheDir(repository: string): string {
    const folderName = repository.replace('/', '-');
    const cachePath = path.join(os.homedir(), '.copilot', 'marketplace-cache', folderName);
    if (!fs.existsSync(cachePath)) {
        fs.mkdirSync(cachePath, { recursive: true });
    }
    return cachePath;
}

/**
 * Ensures a resource subdirectory exists in the disk cache.
 * If it doesn't exist, creates it and calls syncFn to populate it from GitHub.
 */
async function ensureResourceDir(
    cacheBase: string,
    resourceType: string,
    syncFn: () => Promise<void>
): Promise<string> {
    const dir = path.join(cacheBase, resourceType);
    if (!fs.existsSync(dir)) {
        logInfo('DISK_CACHE', `Cache miss for "${resourceType}", syncing from GitHub...`);
        fs.mkdirSync(dir, { recursive: true });
        try {
            await syncFn();
        } catch (err) {
            // Remove the dir on failure so the next call re-attempts the sync
            fs.rmSync(dir, { recursive: true, force: true });
            throw err;
        }
    }
    return dir;
}

/** Downloads all files with `ext` from a flat GitHub directory and writes them to `localDir`. */
async function syncFlatDir(
    repository: string, branch: string,
    remoteDir: string, localDir: string, ext: string
): Promise<void> {
    const files = await fetchDirectoryContents(repository, branch, remoteDir);
    for (const file of files) {
        if (file.type !== 'file' || !file.name.endsWith(ext) || !file.download_url) { continue; }
        const content = await downloadFile(file.download_url);
        fs.writeFileSync(path.join(localDir, file.name), content);
    }
    logInfo('DISK_CACHE', `Synced ${remoteDir} to disk`, { localDir, ext });
}

/** Downloads SKILL.md for every skill folder and writes them into `skillsDir/<name>/SKILL.md`. */
async function syncSkillsDir(repository: string, branch: string, skillsDir: string): Promise<void> {
    const dirs = await fetchDirectoryContents(repository, branch, 'skills');
    for (const dir of dirs.filter(d => d.type === 'dir')) {
        const skillFolder = path.join(skillsDir, dir.name);
        if (!fs.existsSync(skillFolder)) { fs.mkdirSync(skillFolder, { recursive: true }); }
        try {
            const url = `https://raw.githubusercontent.com/${repository}/${branch}/skills/${dir.name}/SKILL.md`;
            fs.writeFileSync(path.join(skillFolder, 'SKILL.md'), await downloadFile(url));
        } catch {
            // No SKILL.md — skip this skill
        }
    }
    logInfo('DISK_CACHE', 'Synced skills to disk', { skillsDir });
}

/** Downloads plugin.json for every plugin and writes it to `pluginsDir/<name>/.github/plugin/plugin.json`. */
async function syncPluginsDir(repository: string, branch: string, pluginsDir: string): Promise<void> {
    const dirs = await fetchDirectoryContents(repository, branch, 'plugins');
    for (const dir of dirs.filter(d => d.type === 'dir')) {
        const manifestDir = path.join(pluginsDir, dir.name, '.github', 'plugin');
        if (!fs.existsSync(manifestDir)) { fs.mkdirSync(manifestDir, { recursive: true }); }
        try {
            const url = `https://raw.githubusercontent.com/${repository}/${branch}/plugins/${dir.name}/.github/plugin/plugin.json`;
            fs.writeFileSync(path.join(manifestDir, 'plugin.json'), await downloadFile(url));
        } catch {
            // No plugin.json — skip
        }
    }
    logInfo('DISK_CACHE', 'Synced plugins to disk', { pluginsDir });
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
        vscode.commands.registerCommand('awesome-copilot-sync.removeRepository', removeRepository),
        vscode.commands.registerCommand('awesome-copilot-sync.syncAgents', () => syncResourceType('agents')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncPrompts', () => syncResourceType('prompts')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncInstructions', () => syncResourceType('instructions')),
        vscode.commands.registerCommand('awesome-copilot-sync.syncSkills', () => syncResourceType('skills')),
        vscode.commands.registerCommand('awesome-copilot-sync.initializeStructure', initializeStructure),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddAgent', findAndAddAgent),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddPrompt', findAndAddPrompt),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddInstruction', findAndAddInstruction),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddSkill', findAndAddSkill),
        vscode.commands.registerCommand('awesome-copilot-sync.findAndAddPlugin', findAndAddPlugin),
        vscode.commands.registerCommand('awesome-copilot-sync.clearCache', clearRepositoryCache),
        vscode.commands.registerCommand('awesome-copilot-sync.showCacheStats', showCacheStats)
    ];

    commands.forEach(command => context.subscriptions.push(command));
    
    logInfo('EXTENSION', 'Registered commands', {
        commandCount: commands.length,
        commands: [
            'configure', 'removeRepository', 'syncAgents', 'syncPrompts', 'syncInstructions',
            'syncSkills', 'initializeStructure', 'findAndAddAgent', 'findAndAddPrompt',
            'findAndAddInstruction', 'findAndAddSkill', 'findAndAddPlugin', 'clearCache', 'showCacheStats'
        ]
    });

    migrateRepositorySettings().catch(err => logError('EXTENSION', 'Settings migration failed', err));

    // Auto sync if enabled
    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const autoSync = config.get('autoSync');
    
    logInfo('EXTENSION', 'Checking auto-sync configuration', { autoSync });
    
    if (autoSync) {
        logInfo('EXTENSION', 'Auto-sync is enabled, but sync-all is no longer supported');
    } else {
        logInfo('EXTENSION', 'Auto-sync is disabled');
    }
    
    logInfo('EXTENSION', 'Extension activation complete!');
}

async function configureRepository() {
    const operationId = generateOperationId();
    logInfo('CONFIG', 'Starting repository configuration', { operationId });

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repos = config.get<RepositoryConfig[]>('repositories') ?? [];

    const repoInput = await vscode.window.showInputBox({
        prompt: 'Enter the repository to sync from (format: owner/repo)',
        placeHolder: 'github/awesome-copilot',
        validateInput: (value) => {
            if (!value || !value.includes('/')) {
                return 'Please enter a valid repository format (owner/repo)';
            }
            return null;
        }
    });
    if (!repoInput) {
        logWarn('CONFIG', 'Configuration cancelled - no repository specified', { operationId });
        return;
    }

    const existingEntry = repos.find(r => r.repository === repoInput);

    const branchInput = await vscode.window.showInputBox({
        prompt: 'Enter the branch to sync from',
        value: existingEntry?.branch ?? 'main'
    });
    if (!branchInput) {
        logWarn('CONFIG', 'Configuration cancelled - no branch specified', { operationId });
        return;
    }

    const labelInput = await vscode.window.showInputBox({
        prompt: 'Enter a friendly label for this repository (optional)',
        value: existingEntry?.label ?? repoInput,
        placeHolder: repoInput
    });
    const label = labelInput?.trim() || repoInput;

    try {
        let updatedRepos: RepositoryConfig[];
        if (existingEntry) {
            updatedRepos = repos.map(r =>
                r.repository === repoInput ? { label, repository: repoInput, branch: branchInput } : r
            );
            vscode.window.showInformationMessage(`Updated repository: ${label} (${repoInput}@${branchInput})`);
            logInfo('CONFIG', 'Repository entry updated', { operationId, repository: repoInput, branch: branchInput });
        } else {
            updatedRepos = [...repos, { label, repository: repoInput, branch: branchInput }];
            vscode.window.showInformationMessage(`Added repository: ${label} (${repoInput}@${branchInput})`);
            logInfo('CONFIG', 'Repository entry added', { operationId, repository: repoInput, branch: branchInput });
        }
        await config.update('repositories', updatedRepos, vscode.ConfigurationTarget.Workspace);
    } catch (error) {
        logError('CONFIG', 'Failed to update configuration', error);
        vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
    }
}

async function removeRepository() {
    const operationId = generateOperationId();
    logInfo('REMOVE_REPO', 'Starting remove repository operation', { operationId });

    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repos = config.get<RepositoryConfig[]>('repositories') ?? [];

    if (repos.length === 0) {
        vscode.window.showInformationMessage('No repositories configured to remove.');
        return;
    }

    const items = repos.map(r => ({
        label: r.label || r.repository,
        description: r.label && r.label !== r.repository ? r.repository : undefined,
        detail: `Branch: ${r.branch || 'main'}`,
        repo: r
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a repository to remove...'
    });
    if (!selected) {
        logWarn('REMOVE_REPO', 'Remove cancelled by user', { operationId });
        return;
    }

    const updatedRepos = repos.filter(r => r.repository !== selected.repo.repository);
    await config.update('repositories', updatedRepos, vscode.ConfigurationTarget.Workspace);
    logInfo('REMOVE_REPO', 'Repository removed', { operationId, repository: selected.repo.repository });
    vscode.window.showInformationMessage(`Removed repository: ${selected.label}`);
}

async function migrateRepositorySettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repos = config.get<RepositoryConfig[]>('repositories') ?? [];
    if (repos.length > 0) {
        return;
    }
    const inspected = config.inspect<string>('targetRepository');
    const wasExplicitlySet = inspected?.workspaceValue !== undefined || inspected?.globalValue !== undefined;
    if (!wasExplicitlySet) {
        return;
    }
    const legacyRepo = config.get<string>('targetRepository')!;
    const legacyBranch = config.get<string>('branch') || 'main';
    const migrated: RepositoryConfig[] = [{ label: legacyRepo, repository: legacyRepo, branch: legacyBranch }];
    await config.update('repositories', migrated, vscode.ConfigurationTarget.Workspace);
    logInfo('MIGRATE', 'Migrated legacy targetRepository to repositories array', { repository: legacyRepo, branch: legacyBranch });
    vscode.window.showInformationMessage(
        `Awesome Copilot: Migrated "${legacyRepo}" to the new multi-repo settings. Use "Configure Repository" to add more.`
    );
}

async function selectRepository(): Promise<{ repository: string; branch: string } | undefined> {
    const config = vscode.workspace.getConfiguration('awesome-copilot-sync');
    const repos = config.get<RepositoryConfig[]>('repositories') ?? [];

    if (repos.length === 0) {
        const repository = config.get<string>('targetRepository') || 'github/awesome-copilot';
        const branch = config.get<string>('branch') || 'main';
        logInfo('SELECT_REPO', 'Falling back to legacy single-repo settings', { repository, branch });
        return { repository, branch };
    }

    if (repos.length === 1) {
        const { repository, branch } = repos[0];
        logInfo('SELECT_REPO', 'Single repository configured, using directly', { repository, branch });
        return { repository, branch: branch || 'main' };
    }

    const items = repos.map(r => ({
        label: r.label || r.repository,
        description: r.label && r.label !== r.repository ? r.repository : undefined,
        detail: `Branch: ${r.branch || 'main'}`,
        repo: r
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a repository to sync from...',
        matchOnDescription: true
    });
    if (!selected) {
        logWarn('SELECT_REPO', 'User cancelled repository selection');
        return undefined;
    }

    logInfo('SELECT_REPO', 'User selected repository', { repository: selected.repo.repository });
    return { repository: selected.repo.repository, branch: selected.repo.branch || 'main' };
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

async function syncResourceType(resourceType: 'agents' | 'prompts' | 'instructions' | 'skills') {
    const operationId = generateOperationId();
    logInfo('SYNC_RESOURCE', 'Starting resource type sync', { operationId, resourceType });

    const repoConfig = await selectRepository();
    if (!repoConfig) {
        logWarn('SYNC_RESOURCE', 'Repository selection cancelled', { operationId });
        return;
    }

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Syncing ${resourceType} from ${repoConfig.repository}`,
        cancellable: false
    }, async () => {
        const result = await syncResourceTypeInternal(resourceType, repoConfig.repository, repoConfig.branch);

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

async function syncResourceTypeInternal(resourceType: string, repository: string, branch: string): Promise<SyncStatus> {
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
    
    // Check cache first
    const cached = repositoryCache.get<GitHubFile[]>(repository, branch, path);
    if (cached) {
        logInfo('API', 'Using cached directory contents', {
            operationId,
            repository,
            branch,
            path,
            fileCount: cached.length
        });
        return cached;
    }
    
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
                        
                        // Cache the successful response
                        repositoryCache.set(repository, branch, path, files);
                        resolve(files);
                    } else if (res.statusCode === 404) {
                        // Directory doesn't exist, return empty array
                        logWarn('API', 'Directory not found, returning empty array', {
                            operationId,
                            repository,
                            branch,
                            path
                        });
                        
                        // Cache the empty result with shorter TTL (1 hour)
                        const emptyResult: GitHubFile[] = [];
                        repositoryCache.set(repository, branch, path, emptyResult, 60 * 60 * 1000);
                        resolve(emptyResult);
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

    const repoConfig = await selectRepository();
    if (!repoConfig) {
        logWarn('FIND_AGENT', 'Repository selection cancelled', { operationId });
        return;
    }
    const { repository, branch } = repoConfig;

    logDebug('FIND_AGENT', 'Configuration loaded', {
        operationId,
        repository,
        branch,
        workspaceFolder
    });

    let agents: AgentMetadata[];
    try {
        agents = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading available agents...',
            cancellable: false
        }, () => getCachedAgentMetadata(repository, branch));
    } catch (error) {
        logError('FIND_AGENT', 'Failed to load agents', { operationId, error });
        vscode.window.showErrorMessage(`Failed to load agents: ${error}`);
        return;
    }

    if (agents.length === 0) {
        logWarn('FIND_AGENT', 'No agents found in repository', { operationId, repository, branch });
        vscode.window.showWarningMessage('No agents found in the target repository.');
        return;
    }

    logInfo('FIND_AGENT', 'Agents loaded successfully', { operationId, agentCount: agents.length });

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
        logInfo('FIND_AGENT', 'Agent selected by user', { operationId, selectedAgent: selectedItem.agent.name });
        await addAgentToProject(selectedItem.agent, workspaceFolder, repository, branch);
    } else {
        logWarn('FIND_AGENT', 'No agent selected by user', { operationId });
    }
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
        
        const content = agent.localPath
            ? fs.readFileSync(agent.localPath, 'utf8')
            : await downloadFile(agent.downloadUrl);
        
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

function parseSkillMetadata(folderName: string, content: string, downloadUrl: string): SkillMetadata {
    const name = folderName.replace(/-/g, ' ')
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
        filename: folderName,
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
        const content = prompt.localPath
            ? fs.readFileSync(prompt.localPath, 'utf8')
            : await downloadFile(prompt.downloadUrl);
        
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
        const content = instruction.localPath
            ? fs.readFileSync(instruction.localPath, 'utf8')
            : await downloadFile(instruction.downloadUrl);
        
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
        // Create the skill's own subfolder under .github/skills/
        const skillDir = path.join(workspaceFolder, '.github', 'skills', skill.filename);
        if (!fs.existsSync(skillDir)) {
            fs.mkdirSync(skillDir, { recursive: true });
        }

        let firstFilePath: string | undefined;

        if (skill.localPath) {
            // Copy directly from local CLI marketplace cache
            for (const fileName of fs.readdirSync(skill.localPath)) {
                const srcPath = path.join(skill.localPath, fileName);
                if (!fs.statSync(srcPath).isFile()) { continue; }
                const content = fs.readFileSync(srcPath, 'utf8');
                const attribution = createAttributionComment(repository, branch, `skills/${skill.filename}/${fileName}`);
                const destPath = path.join(skillDir, fileName);
                fs.writeFileSync(destPath, attribution + content);
                if (!firstFilePath) { firstFilePath = destPath; }
            }
        } else {
            // Fetch all files inside the skill folder from the repository
            const files = await fetchDirectoryContents(repository, branch, `skills/${skill.filename}`);
            for (const file of files) {
                if (file.type !== 'file' || !file.download_url) { continue; }
                const content = await downloadFile(file.download_url);
                const attribution = createAttributionComment(repository, branch, `skills/${skill.filename}/${file.name}`);
                const localPath = path.join(skillDir, file.name);
                fs.writeFileSync(localPath, attribution + content);
                if (!firstFilePath) { firstFilePath = localPath; }
            }
        }

        const action = await vscode.window.showInformationMessage(
            `✅ Added skill "${skill.name}" to your project!`,
            'Open File'
        );

        if (action === 'Open File' && firstFilePath) {
            const document = await vscode.workspace.openTextDocument(firstFilePath);
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

    const repoConfig = await selectRepository();
    if (!repoConfig) {
        logWarn('FIND_PROMPT', 'Repository selection cancelled', { operationId });
        return;
    }
    const { repository, branch } = repoConfig;

    let prompts: PromptMetadata[];
    try {
        prompts = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading available prompts...',
            cancellable: false
        }, () => getCachedPromptMetadata(repository, branch));
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to load prompts: ${error}`);
        return;
    }

    if (prompts.length === 0) {
        vscode.window.showWarningMessage('No prompts found in the target repository.');
        return;
    }

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
}

async function findAndAddInstruction() {
    const operationId = generateOperationId();
    logInfo('FIND_INSTRUCTION', 'Starting find and add instruction operation', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('FIND_INSTRUCTION', 'No workspace folder found', { operationId });
        return;
    }

    const repoConfig = await selectRepository();
    if (!repoConfig) {
        logWarn('FIND_INSTRUCTION', 'Repository selection cancelled', { operationId });
        return;
    }
    const { repository, branch } = repoConfig;

    let instructions: InstructionMetadata[];
    try {
        instructions = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading available instructions...',
            cancellable: false
        }, () => getCachedInstructionMetadata(repository, branch));
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to load instructions: ${error}`);
        return;
    }

    if (instructions.length === 0) {
        vscode.window.showWarningMessage('No instructions found in the target repository.');
        return;
    }

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
}

async function findAndAddSkill() {
    const operationId = generateOperationId();
    logInfo('FIND_SKILL', 'Starting find and add skill operation', { operationId });
    
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('FIND_SKILL', 'No workspace folder found', { operationId });
        return;
    }

    const repoConfig = await selectRepository();
    if (!repoConfig) {
        logWarn('FIND_SKILL', 'Repository selection cancelled', { operationId });
        return;
    }
    const { repository, branch } = repoConfig;

    let skills: SkillMetadata[];
    try {
        skills = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading available skills...',
            cancellable: false
        }, () => getCachedSkillMetadata(repository, branch));
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to load skills: ${error}`);
        return;
    }

    if (skills.length === 0) {
        vscode.window.showWarningMessage('No skills found in the target repository.');
        return;
    }

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
}

export function deactivate() {
    logInfo('EXTENSION', 'Extension is being deactivated');
    repositoryCache.clear();
}

// Cache management functions
async function clearRepositoryCache() {
    const operationId = generateOperationId();
    logInfo('CACHE_MGMT', 'Clearing repository cache', { operationId });
    
    const stats = repositoryCache.getStats();
    repositoryCache.clear();
    
    logInfo('CACHE_MGMT', 'Repository cache cleared', { 
        operationId,
        previousStats: stats 
    });
    
    vscode.window.showInformationMessage(
        `✅ Repository cache cleared! (${stats.entries} entries freed)`
    );
}

async function showCacheStats() {
    const operationId = generateOperationId();
    logInfo('CACHE_MGMT', 'Showing cache statistics', { operationId });
    
    const stats = repositoryCache.getStats();
    const sizeInKB = Math.round(stats.totalSize / 1024);
    
    logInfo('CACHE_MGMT', 'Cache statistics retrieved', {
        operationId,
        stats,
        sizeInKB
    });
    
    const message = stats.entries > 0
        ? `📊 Cache Statistics:\n• ${stats.entries} cached entries\n• ${sizeInKB} KB total size\n• 24-hour TTL (1 hour for 404s)`
        : '📊 Cache is currently empty';
    
    if (stats.entries > 0) {
        const selectedAction = await vscode.window.showInformationMessage(message, 'Clear Cache');
        if (selectedAction === 'Clear Cache') {
            await clearRepositoryCache();
        }
    } else {
        vscode.window.showInformationMessage(message);
    }
}

interface PluginManifest {
    name: string;
    description: string;
    version?: string;
    keywords?: string[];
    agents?: string[];
    skills?: string[];
    prompts?: string[];
    instructions?: string[];
}

interface PluginEntry {
    folderName: string;
    pluginPath: string;
    manifest: PluginManifest;
    localPath?: string;
}

async function fetchPluginList(repository: string, branch: string): Promise<PluginEntry[]> {
    const entries: PluginEntry[] = [];
    const localBase = getLocalCachePath(repository);

    if (localBase) {
        logInfo('PLUGIN', 'Reading plugin list from local CLI cache', { localBase });
        const pluginsDir = path.join(localBase, 'plugins');
        if (fs.existsSync(pluginsDir)) {
            for (const folderName of fs.readdirSync(pluginsDir)) {
                const manifestPath = path.join(pluginsDir, folderName, '.github', 'plugin', 'plugin.json');
                if (!fs.existsSync(manifestPath)) { continue; }
                try {
                    const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    entries.push({
                        folderName,
                        pluginPath: `plugins/${folderName}`,
                        manifest,
                        localPath: path.join(pluginsDir, folderName)
                    });
                } catch {
                    // malformed plugin.json — skip
                }
            }
        }
    } else {
        logInfo('PLUGIN', 'Fetching plugin list from GitHub API');
        const pluginDirs = await fetchDirectoryContents(repository, branch, 'plugins');
        await Promise.all(pluginDirs.filter(f => f.type === 'dir').map(async (dir) => {
            try {
                const manifestUrl = `https://raw.githubusercontent.com/${repository}/${branch}/plugins/${dir.name}/.github/plugin/plugin.json`;
                const manifest: PluginManifest = JSON.parse(await downloadFile(manifestUrl));
                entries.push({ folderName: dir.name, pluginPath: `plugins/${dir.name}`, manifest });
            } catch {
                // plugin.json missing or malformed — skip
            }
        }));
    }

    return entries.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

async function installPluginResources(
    entry: PluginEntry,
    repository: string,
    branch: string,
    workspaceFolder: string
): Promise<{ installed: string[]; errors: string[] }> {
    const installed: string[] = [];
    const errors: string[] = [];

    const resourceMappings: Array<{ manifestKey: keyof PluginManifest; localDir: string }> = [
        { manifestKey: 'agents', localDir: 'agents' },
        { manifestKey: 'prompts', localDir: 'prompts' },
        { manifestKey: 'instructions', localDir: 'instructions' },
        { manifestKey: 'skills', localDir: 'skills' },
    ];

    for (const { manifestKey, localDir } of resourceMappings) {
        const paths = (entry.manifest[manifestKey] as string[] | undefined) ?? [];
        for (const relPath of paths) {
            const normalized = relPath.replace(/^\.\//, '');
            const segments = normalized.split('/');
            const targetSubDir = segments.length > 1
                ? path.join(workspaceFolder, '.github', localDir, ...segments.slice(1))
                : path.join(workspaceFolder, '.github', localDir);

            if (!fs.existsSync(targetSubDir)) {
                fs.mkdirSync(targetSubDir, { recursive: true });
            }

            try {
                if (entry.localPath) {
                    // Read from local CLI cache
                    const srcDir = path.join(entry.localPath, normalized);
                    if (!fs.existsSync(srcDir)) { continue; }
                    for (const fileName of fs.readdirSync(srcDir)) {
                        const srcFile = path.join(srcDir, fileName);
                        if (!fs.statSync(srcFile).isFile()) { continue; }
                        const content = fs.readFileSync(srcFile, 'utf8');
                        const attribution = createAttributionComment(repository, branch, `${entry.pluginPath}/${normalized}/${fileName}`);
                        fs.writeFileSync(path.join(targetSubDir, fileName), attribution + content);
                        installed.push(fileName);
                    }
                } else {
                    // Download from GitHub API
                    const repoPath = `${entry.pluginPath}/${normalized}`;
                    const files = (await fetchDirectoryContents(repository, branch, repoPath)).filter(f => f.type === 'file');
                    for (const file of files) {
                        if (!file.download_url) { continue; }
                        const content = await downloadFile(file.download_url);
                        const attribution = createAttributionComment(repository, branch, `${repoPath}/${file.name}`);
                        fs.writeFileSync(path.join(targetSubDir, file.name), attribution + content);
                        installed.push(file.name);
                    }
                }
            } catch (err) {
                errors.push(`${relPath}: ${err}`);
            }
        }
    }

    return { installed, errors };
}

async function findAndAddPlugin() {
    const operationId = generateOperationId();
    logInfo('FIND_PLUGIN', 'Starting find and add plugin operation', { operationId });

    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
        logError('FIND_PLUGIN', 'No workspace folder found', { operationId });
        return;
    }

    const repoConfig = await selectRepository();
    if (!repoConfig) {
        logWarn('FIND_PLUGIN', 'Repository selection cancelled', { operationId });
        return;
    }
    const { repository, branch } = repoConfig;

    let plugins: PluginEntry[];
    try {
        plugins = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading available plugins...',
            cancellable: false
        }, () => fetchPluginList(repository, branch));
    } catch (error) {
        logError('FIND_PLUGIN', 'Failed to load plugins', { operationId, error });
        vscode.window.showErrorMessage(`Failed to load plugins: ${error}`);
        return;
    }

    if (plugins.length === 0) {
        vscode.window.showWarningMessage('No plugins found in the target repository.');
        return;
    }

    const quickPickItems = plugins.map(p => ({
        label: p.manifest.name,
        description: p.manifest.description,
        detail: p.manifest.keywords?.join(', '),
        entry: p
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Search and select a plugin to add to your project...'
    });

    if (!selected) { return; }

    logInfo('FIND_PLUGIN', 'User selected plugin', { operationId, plugin: selected.entry.folderName });

    let installed: string[], errors: string[];
    try {
        ({ installed, errors } = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing plugin "${selected.label}"...`,
            cancellable: false
        }, () => installPluginResources(selected.entry, repository, branch, workspaceFolder)));
    } catch (error) {
        logError('FIND_PLUGIN', 'Failed to install plugin', { operationId, error });
        vscode.window.showErrorMessage(`Failed to install plugin: ${error}`);
        return;
    }

    logInfo('FIND_PLUGIN', 'Plugin installation complete', { operationId, installed: installed.length, errors: errors.length });

    if (errors.length > 0) {
        vscode.window.showWarningMessage(
            `Plugin "${selected.label}" installed with ${installed.length} file(s). ${errors.length} error(s): ${errors.join('; ')}`
        );
    } else {
        vscode.window.showInformationMessage(
            `Plugin "${selected.label}" installed — ${installed.length} file(s) added to your project.`
        );
    }
}

function createAttributionComment(repository: string, branch: string, resourcePath: string): string {
    return `# Synced from: https://github.com/${repository}/blob/${branch}/${resourcePath}\n`;
}