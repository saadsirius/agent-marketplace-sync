import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as childProcess from 'child_process';

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

    const cacheBase = getLocalCacheDir(repository);
    await ensureRepoCached(cacheBase, repository, branch);
    const agentsDir = path.join(cacheBase, 'agents');

    const agents: AgentMetadata[] = [];
    for (const file of fs.readdirSync(agentsDir).filter(f => f.endsWith('.agent.md'))) {
        try {
            const localPath = path.join(agentsDir, file);
            const content = fs.readFileSync(localPath, 'utf8');
            const downloadUrl = `https://raw.githubusercontent.com/${repository}/${branch}/agents/${file}`;
            const metadata = parseAgentMetadata(file, content, downloadUrl);
            metadata.localPath = localPath;
            agents.push(metadata);
        } catch (error) {
            logWarn('METADATA_CACHE', 'Failed to parse agent', { file, error });
        }
    }

    repositoryCache.set(repository, branch, cacheKey, agents);
    logInfo('METADATA_CACHE', 'Agent metadata cached', { count: agents.length });
    return agents;
}


async function getCachedInstructionMetadata(repository: string, branch: string): Promise<InstructionMetadata[]> {
    const cacheKey = 'parsed-instructions';
    const cached = repositoryCache.get<InstructionMetadata[]>(repository, branch, cacheKey);
    if (cached) {
        logInfo('METADATA_CACHE', 'Using cached instruction metadata', { count: cached.length });
        return cached;
    }

    const cacheBase = getLocalCacheDir(repository);
    await ensureRepoCached(cacheBase, repository, branch);
    const instructionsDir = path.join(cacheBase, 'instructions');

    const instructions: InstructionMetadata[] = [];
    for (const file of fs.readdirSync(instructionsDir).filter(f => f.endsWith('.instructions.md'))) {
        try {
            const localPath = path.join(instructionsDir, file);
            const content = fs.readFileSync(localPath, 'utf8');
            const downloadUrl = `https://raw.githubusercontent.com/${repository}/${branch}/instructions/${file}`;
            const metadata = parseInstructionMetadata(file, content, downloadUrl);
            metadata.localPath = localPath;
            instructions.push(metadata);
        } catch (error) {
            logWarn('METADATA_CACHE', 'Failed to parse instruction', { file, error });
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

    const cacheBase = getLocalCacheDir(repository);
    await ensureRepoCached(cacheBase, repository, branch);
    const skillsDir = path.join(cacheBase, 'skills');

    const skills: SkillMetadata[] = [];
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
            logWarn('METADATA_CACHE', 'Failed to parse skill', { folderName, error });
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
    repository: string;
    branch: string;
}

/** Parses a GitHub repo from either "owner/repo" or a full URL. Returns "owner/repo" or null if invalid. */
function parseGitHubRepo(input: string): string | null {
    const trimmed = input.trim();
    // Full URL: https://github.com/owner/repo or github.com/owner/repo (with optional trailing slash or .git)
    const urlMatch = trimmed.match(/(?:https?:\/\/)?github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/);
    if (urlMatch) {
        return urlMatch[1];
    }
    // Plain owner/repo
    if (/^[^/]+\/[^/]+$/.test(trimmed)) {
        return trimmed;
    }
    return null;
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

/** Returns the GitHub OAuth token from VS Code's built-in GitHub auth session, or undefined if not available. */
async function getGitHubToken(): Promise<string | undefined> {
    try {
        const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
        return session?.accessToken;
    } catch {
        return undefined;
    }
}

/** Prompts the user to sign in with GitHub and shows the result. */
async function signInWithGitHub(): Promise<void> {
    try {
        const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
        if (session) {
            vscode.window.showInformationMessage(`Signed in to GitHub as ${session.account.label}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`GitHub sign-in failed: ${error}`);
    }
}

/** Builds request headers for GitHub requests. Prompts for sign-in if no token is available. */
async function buildGitHubHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    let token = await getGitHubToken();
    if (!token) {
        try {
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
            token = session?.accessToken;
        } catch {
            // User dismissed the prompt — proceed unauthenticated
        }
    }
    const headers: Record<string, string> = {
        'User-Agent': 'VSCode-Awesome-Copilot-Sync',
        ...extra,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/** Downloads a binary file from `url` to `destPath`, following redirects. */
async function downloadBinaryToFile(url: string, destPath: string): Promise<void> {
    const headers = await buildGitHubHeaders();
    return new Promise((resolve, reject) => {
        const doRequest = (requestUrl: string) => {
            https.get(requestUrl, { headers }, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    doRequest(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${res.statusCode} downloading ${requestUrl}`));
                    return;
                }
                const file = fs.createWriteStream(destPath);
                res.pipe(file);
                file.on('finish', () => file.close(() => resolve()));
                file.on('error', reject);
                res.on('error', reject);
            }).on('error', reject);
        };
        doRequest(url);
    });
}

/**
 * Downloads the entire repository as a tarball and extracts it into `destDir`.
 * GitHub tarballs have a single top-level folder (e.g. `repo-sha/`); --strip-components=1
 * removes it so the repo contents land directly in `destDir`.
 */
async function downloadRepoTarball(repository: string, branch: string, destDir: string): Promise<void> {
    const [owner, repo] = repository.split('/');
    const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${branch}`;
    const tmpFile = path.join(os.tmpdir(), `awesome-copilot-${Date.now()}.tar.gz`);

    logInfo('DISK_CACHE', 'Downloading repository tarball', { repository, branch, url, destDir });
    try {
        await downloadBinaryToFile(url, tmpFile);
        if (!fs.existsSync(destDir)) { fs.mkdirSync(destDir, { recursive: true }); }
        await new Promise<void>((resolve, reject) => {
            childProcess.exec(
                `tar -xz --strip-components=1 -C "${destDir}" -f "${tmpFile}"`,
                (err) => { if (err) { reject(err); } else { resolve(); } }
            );
        });
        logInfo('DISK_CACHE', 'Repository tarball extracted', { repository, branch, destDir });
    } finally {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
    }
}

/**
 * Ensures the full repository is cached locally.
 * Downloads and extracts the tarball on first access; subsequent calls are no-ops.
 * Call with `force = true` to re-download even if the cache exists.
 */
async function ensureRepoCached(cacheBase: string, repository: string, branch: string, force = false): Promise<void> {
    const sentinelPath = path.join(cacheBase, '.synced');
    if (!force && fs.existsSync(sentinelPath)) { return; }

    logInfo('DISK_CACHE', `Downloading full repository "${repository}"...`);
    // Clear any partial/stale state before re-downloading
    if (fs.existsSync(cacheBase)) {
        fs.rmSync(cacheBase, { recursive: true, force: true });
    }
    await downloadRepoTarball(repository, branch, cacheBase);
    fs.writeFileSync(sentinelPath, new Date().toISOString());
}

/** Downloads the full marketplace repo, replacing the local cache. */
async function syncMarketplaceResources(repository: string, branch: string, cacheDir: string): Promise<void> {
    await ensureRepoCached(cacheDir, repository, branch, /* force */ true);
    logInfo('MARKETPLACE', 'Completed marketplace resource sync', { repository, branch, cacheDir });
}

/**
 * Ensures a marketplace is cached locally by syncing it from GitHub if needed.
 * Similar to how `copilot plugin marketplace` works locally.
 */
async function ensureMarketplaceSynced(repository: string, branch: string): Promise<void> {
    const cacheDir = getLocalCacheDir(repository);
    logInfo('MARKETPLACE', 'Ensuring marketplace is synced', { repository, branch, cacheDir });
    try {
        await ensureRepoCached(cacheDir, repository, branch);
    } catch (err) {
        logError('MARKETPLACE', 'Failed to sync marketplace', { repository, error: err });
        throw err;
    }
}

export function activate(context: vscode.ExtensionContext) {
    logInfo('EXTENSION', 'Agent Marketplace Sync extension is activating...');
    
    const extensionVersion = context.extension.packageJSON.version;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    logInfo('EXTENSION', 'Extension details', {
        version: extensionVersion,
        workspaceFolders: workspaceFolders?.length || 0,
        activeWorkspace: workspaceFolders?.[0]?.uri.fsPath
    });

    // Register commands
    const commands = [
        vscode.commands.registerCommand('agent-marketplace-sync.configure', configureRepository),
        vscode.commands.registerCommand('agent-marketplace-sync.removeRepository', removeRepository),
        vscode.commands.registerCommand('agent-marketplace-sync.syncMarketplace', syncMarketplace),
        vscode.commands.registerCommand('agent-marketplace-sync.initializeStructure', initializeStructure),
        vscode.commands.registerCommand('agent-marketplace-sync.findAndAddAgent', findAndAddAgent),
        vscode.commands.registerCommand('agent-marketplace-sync.findAndAddInstruction', findAndAddInstruction),
        vscode.commands.registerCommand('agent-marketplace-sync.findAndAddSkill', findAndAddSkill),
        vscode.commands.registerCommand('agent-marketplace-sync.findAndAddPlugin', findAndAddPlugin),
        vscode.commands.registerCommand('agent-marketplace-sync.clearCache', clearRepositoryCache),
        vscode.commands.registerCommand('agent-marketplace-sync.showCacheStats', showCacheStats),
        vscode.commands.registerCommand('agent-marketplace-sync.signIn', signInWithGitHub)
    ];

    commands.forEach(command => context.subscriptions.push(command));
    
    logInfo('EXTENSION', 'Registered commands', {
        commandCount: commands.length,
        commands: [
            'configure', 'removeRepository', 'syncMarketplace', 'initializeStructure', 'findAndAddAgent',
            'findAndAddInstruction', 'findAndAddSkill', 'findAndAddPlugin', 'clearCache', 'showCacheStats'
        ]
    });

    migrateRepositorySettings().catch(err => logError('EXTENSION', 'Settings migration failed', err));

    // Auto sync if enabled
    const config = vscode.workspace.getConfiguration('agent-marketplace-sync');
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

    const config = vscode.workspace.getConfiguration('agent-marketplace-sync');
    const repos = config.get<RepositoryConfig[]>('repositories') ?? [];

    const rawInput = await vscode.window.showInputBox({
        prompt: 'Enter the marketplace repository (owner/repo or full GitHub URL)',
        placeHolder: 'github/awesome-copilot',
        value: 'github/awesome-copilot',
        validateInput: (value) => {
            if (!value) {
                return 'Please enter a repository';
            }
            const stripped = parseGitHubRepo(value);
            if (!stripped) {
                return 'Please enter a valid repository (owner/repo or https://github.com/owner/repo)';
            }
            return null;
        }
    });
    if (!rawInput) {
        logWarn('CONFIG', 'Configuration cancelled - no repository specified', { operationId });
        return;
    }
    const repoInput = parseGitHubRepo(rawInput)!;

    const existingEntry = repos.find(r => r.repository === repoInput);

    const branchInput = await vscode.window.showInputBox({
        prompt: 'Enter the branch to sync from',
        value: existingEntry?.branch ?? 'main'
    });
    if (!branchInput) {
        logWarn('CONFIG', 'Configuration cancelled - no branch specified', { operationId });
        return;
    }

    try {
        let updatedRepos: RepositoryConfig[];
        let isNewEntry = false;
        if (existingEntry) {
            updatedRepos = repos.map(r =>
                r.repository === repoInput ? { repository: repoInput, branch: branchInput } : r
            );
            vscode.window.showInformationMessage(`Updated repository: ${repoInput}@${branchInput}`);
            logInfo('CONFIG', 'Repository entry updated', { operationId, repository: repoInput, branch: branchInput });
        } else {
            updatedRepos = [...repos, { repository: repoInput, branch: branchInput }];
            isNewEntry = true;
            vscode.window.showInformationMessage(`Added repository: ${repoInput}@${branchInput}`);
            logInfo('CONFIG', 'Repository entry added', { operationId, repository: repoInput, branch: branchInput });
        }
        await config.update('repositories', updatedRepos, vscode.ConfigurationTarget.Global);
        
        // Sync the marketplace if it's a new entry
        if (isNewEntry) {
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Syncing marketplace ${repoInput}...`,
                    cancellable: false
                }, () => ensureMarketplaceSynced(repoInput, branchInput));
                logInfo('CONFIG', 'Marketplace synced after configuration', { operationId, repository: repoInput });
            } catch (syncError) {
                logWarn('CONFIG', 'Failed to sync marketplace after configuration', { operationId, repository: repoInput, error: syncError });
                // Don't block the user if sync fails - marketplace can be synced later
            }
        }
    } catch (error) {
        logError('CONFIG', 'Failed to update configuration', error);
        vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
    }
}

async function removeRepository() {
    const operationId = generateOperationId();
    logInfo('REMOVE_REPO', 'Starting remove repository operation', { operationId });

    const config = vscode.workspace.getConfiguration('agent-marketplace-sync');
    const repos = config.get<RepositoryConfig[]>('repositories') ?? [];

    if (repos.length === 0) {
        vscode.window.showInformationMessage('No repositories configured to remove.');
        return;
    }

    const items = repos.map(r => ({
        label: r.repository,
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
    await config.update('repositories', updatedRepos, vscode.ConfigurationTarget.Global);
    logInfo('REMOVE_REPO', 'Repository removed', { operationId, repository: selected.repo.repository });
    vscode.window.showInformationMessage(`Removed repository: ${selected.repo.repository}`);
}

async function syncMarketplace() {
    const operationId = generateOperationId();
    logInfo('SYNC_MARKETPLACE', 'Starting marketplace sync', { operationId });

    const repoConfig = await selectRepository();
    if (!repoConfig) {
        logWarn('SYNC_MARKETPLACE', 'Marketplace selection cancelled', { operationId });
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Syncing marketplace ${repoConfig.repository}...`,
            cancellable: false
        }, async () => {
            await syncMarketplaceResources(repoConfig.repository, repoConfig.branch, getLocalCacheDir(repoConfig.repository));
            logInfo('SYNC_MARKETPLACE', 'Marketplace sync completed', { operationId, repository: repoConfig.repository });
        });

        vscode.window.showInformationMessage(`✅ Marketplace synced: ${repoConfig.repository}`);
    } catch (error) {
        logError('SYNC_MARKETPLACE', 'Failed to sync marketplace', { operationId, error });
        vscode.window.showErrorMessage(`Failed to sync marketplace: ${error}`);
    }
}

async function migrateRepositorySettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('agent-marketplace-sync');
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
    const migrated: RepositoryConfig[] = [{ repository: legacyRepo, branch: legacyBranch }];
    await config.update('repositories', migrated, vscode.ConfigurationTarget.Global);
    logInfo('MIGRATE', 'Migrated legacy targetRepository to repositories array', { repository: legacyRepo, branch: legacyBranch });
    vscode.window.showInformationMessage(
        `Agent Marketplace: Migrated "${legacyRepo}" to the new multi-marketplace settings. Use "Configure Marketplace" to add more.`
    );
}

async function selectRepository(): Promise<{ repository: string; branch: string } | undefined> {
    const config = vscode.workspace.getConfiguration('agent-marketplace-sync');
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
        label: r.repository,
        detail: `Branch: ${r.branch || 'main'}`,
        repo: r
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a repository to sync from...'
    });
    if (!selected) {
        logWarn('SELECT_REPO', 'User cancelled repository selection');
        return undefined;
    }

    logInfo('SELECT_REPO', 'User selected repository', { repository: selected.repo.repository });
    return { repository: selected.repo.repository, branch: selected.repo.branch || 'main' };
}

// Utility functions for configurable directory support
const INSTRUCTIONS_FILE = 'copilot-instructions.md';

function getBaseDirectory(): string {
    const config = vscode.workspace.getConfiguration('agent-marketplace-sync');
    return config.get<string>('baseDirectory') ?? '.github';
}

function getResourcePath(workspaceFolder: string, resourceType: string, baseDir?: string): string {
    const dir = baseDir ?? getBaseDirectory();
    return path.join(workspaceFolder, dir, resourceType);
}

function getInstructionsPath(workspaceFolder: string, baseDir?: string): string {
    const dir = baseDir ?? getBaseDirectory();
    return path.join(workspaceFolder, dir, INSTRUCTIONS_FILE);
}

function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
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

    const baseDir = getBaseDirectory();
    const directories = [
        baseDir,
        `${baseDir}/agents`,
        `${baseDir}/instructions`,
        `${baseDir}/skills`
    ];

    try {
        logDebug('INIT', 'Creating directory structure', {
            operationId,
            directories
        });

        for (const dir of directories) {
            const dirPath = path.join(workspaceFolder, dir);
            ensureDirectoryExists(dirPath);
            logDebug('INIT', 'Directory ready', {
                operationId,
                directory: dir,
                fullPath: dirPath
            });
        }

        // Create basic copilot-instructions.md if it doesn't exist
        const instructionsPath = getInstructionsPath(workspaceFolder, baseDir);
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
    
    const requestHeaders = await buildGitHubHeaders({ 'Accept': 'application/vnd.github.v3+json' });

    logDebug('API', 'Making GitHub API request', {
        operationId,
        headers: requestHeaders
    });

    return new Promise((resolve, reject) => {
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

    const headers = await buildGitHubHeaders();
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
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
        vscode.window.showWarningMessage('No agents found in the marketplace.');
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
        const agentsDir = getResourcePath(workspaceFolder, 'agents');
        ensureDirectoryExists(agentsDir);

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
        const finalContent = content + attribution;

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

async function addInstructionToProject(instruction: InstructionMetadata, workspaceFolder: string, repository: string, branch: string) {
    try {
        // Ensure instructions directory exists
        const instructionsDir = getResourcePath(workspaceFolder, 'instructions');
        ensureDirectoryExists(instructionsDir);

        // Download the instruction content
        const content = instruction.localPath
            ? fs.readFileSync(instruction.localPath, 'utf8')
            : await downloadFile(instruction.downloadUrl);
        
        // Add attribution header
        const attribution = createAttributionComment(repository, branch, `instructions/${instruction.filename}`);
        const finalContent = content + attribution;

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
        // Create the skill's own subfolder under base directory/skills/
        const skillDir = path.join(getResourcePath(workspaceFolder, 'skills'), skill.filename);
        ensureDirectoryExists(skillDir);

        let firstFilePath: string | undefined;

        // localPath is always set with unified disk cache
        if (!skill.localPath) {
            throw new Error('Skill metadata missing local path');
        }

        // Copy all files from the cached skill folder
        for (const fileName of fs.readdirSync(skill.localPath)) {
            const srcPath = path.join(skill.localPath, fileName);
            if (!fs.statSync(srcPath).isFile()) { continue; }
            const content = fs.readFileSync(srcPath, 'utf8');
            const attribution = createAttributionComment(repository, branch, `skills/${skill.filename}/${fileName}`);
            const destPath = path.join(skillDir, fileName);
            fs.writeFileSync(destPath, content + attribution);
            if (!firstFilePath) { firstFilePath = destPath; }
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
        vscode.window.showWarningMessage('No instructions found in the marketplace.');
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
        vscode.window.showWarningMessage('No skills found in the marketplace.');
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
    
    // Clear disk cache for all configured repositories
    const config = vscode.workspace.getConfiguration('agent-marketplace-sync');
    const repositories: RepositoryConfig[] = config.get('repositories') ?? [];
    for (const repo of repositories) {
        const folderName = repo.repository.replace('/', '-');
        const cachePath = path.join(os.homedir(), '.copilot', 'marketplace-cache', folderName);
        if (fs.existsSync(cachePath)) {
            try {
                fs.rmSync(cachePath, { recursive: true, force: true });
                logInfo('CACHE_MGMT', 'Cleared disk cache for repository', { repository: repo.repository, cachePath });
            } catch (err) {
                logError('CACHE_MGMT', 'Failed to clear disk cache', { repository: repo.repository, cachePath, error: err });
            }
        }
    }
    
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
    instructions?: string[];
    prompts?: string[];
}

interface PluginEntry {
    folderName: string;
    pluginPath: string;
    manifest: PluginManifest;
    localPath?: string;
}

async function fetchPluginList(repository: string, branch: string): Promise<PluginEntry[]> {
    const cacheBase = getLocalCacheDir(repository);
    await ensureRepoCached(cacheBase, repository, branch);
    const pluginsDir = path.join(cacheBase, 'plugins');
    if (!fs.existsSync(pluginsDir)) { return []; }

    const entries: PluginEntry[] = [];
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

    // Cache base directory to avoid repeated configuration reads in nested loops
    const baseDir = getBaseDirectory();

    const resourceMappings: Array<{ manifestKey: keyof PluginManifest; localDir: string }> = [
        { manifestKey: 'agents', localDir: 'agents' },
        { manifestKey: 'instructions', localDir: 'instructions' },
        { manifestKey: 'skills', localDir: 'skills' },
        { manifestKey: 'prompts', localDir: 'prompts' },
    ];

    for (const { manifestKey, localDir } of resourceMappings) {
        const paths = (entry.manifest[manifestKey] as string[] | undefined) ?? [];
        for (const relPath of paths) {
            const normalized = relPath.replace(/^\.\//, '');
            const segments = normalized.split('/');
            const targetSubDir = segments.length > 1
                ? path.join(getResourcePath(workspaceFolder, localDir, baseDir), ...segments.slice(1))
                : getResourcePath(workspaceFolder, localDir, baseDir);

            ensureDirectoryExists(targetSubDir);

            try {
                // localPath is always set with unified disk cache
                if (!entry.localPath) {
                    throw new Error('Plugin entry missing local path');
                }
                const srcDir = path.join(entry.localPath, normalized);
                if (!fs.existsSync(srcDir)) { continue; }
                for (const fileName of fs.readdirSync(srcDir)) {
                    const srcFile = path.join(srcDir, fileName);
                    if (!fs.statSync(srcFile).isFile()) { continue; }
                    const content = fs.readFileSync(srcFile, 'utf8');
                    const attribution = createAttributionComment(repository, branch, `${entry.pluginPath}/${normalized}/${fileName}`);
                    fs.writeFileSync(path.join(targetSubDir, fileName), content + attribution);
                    installed.push(fileName);
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
        vscode.window.showWarningMessage('No plugins found in the marketplace.');
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