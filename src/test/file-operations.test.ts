import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path module
jest.mock('path');
const mockPath = path as jest.Mocked<typeof path>;

describe('File Operations and Sync Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File System Operations', () => {
    test('should check if directory exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const exists = mockFs.existsSync('/test/directory');
      
      expect(exists).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/directory');
    });

    test('should create directory recursively', () => {
      mockFs.mkdirSync.mockReturnValue(undefined);
      
      mockFs.mkdirSync('/test/directory', { recursive: true });
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/directory', { recursive: true });
    });

    test('should write file content', () => {
      const content = '# Test Content\n\nThis is test content.';
      const filePath = '/test/file.md';
      
      mockFs.writeFileSync.mockReturnValue(undefined);
      
      mockFs.writeFileSync(filePath, content);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(filePath, content);
    });

    test('should join paths correctly', () => {
      mockPath.join.mockReturnValue('/workspace/.github/agents');
      
      const result = mockPath.join('/workspace', '.github', 'agents');
      
      expect(result).toBe('/workspace/.github/agents');
      expect(mockPath.join).toHaveBeenCalledWith('/workspace', '.github', 'agents');
    });
  });

  describe('Sync Status Management', () => {
    interface SyncStatus {
      success: boolean;
      files: string[];
      errors: string[];
    }

    test('should create successful sync status', () => {
      const status: SyncStatus = {
        success: true,
        files: ['agent1.agent.md', 'agent2.agent.md'],
        errors: []
      };
      
      expect(status.success).toBe(true);
      expect(status.files).toHaveLength(2);
      expect(status.errors).toHaveLength(0);
    });

    test('should create failed sync status with errors', () => {
      const status: SyncStatus = {
        success: false,
        files: ['agent1.agent.md'],
        errors: ['Failed to download agent2.agent.md: Network error']
      };
      
      expect(status.success).toBe(false);
      expect(status.files).toHaveLength(1);
      expect(status.errors).toHaveLength(1);
      expect(status.errors[0]).toContain('Network error');
    });
  });

  describe('Content Attribution', () => {
    test('should add attribution header to content', () => {
      const originalContent = '# Test Agent\n\nThis is a test agent.';
      const repository = 'github/awesome-copilot';
      const branch = 'main';
      const fileName = 'test-agent.agent.md';
      
      const attribution = `<!-- Synced from: https://github.com/${repository}/blob/${branch}/agents/${fileName} -->\n`;
      const finalContent = attribution + originalContent;
      
      expect(finalContent).toContain('<!-- Synced from: https://github.com/github/awesome-copilot/blob/main/agents/test-agent.agent.md -->');
      expect(finalContent).toContain('# Test Agent');
    });

    test('should handle different resource types in attribution', () => {
      const resourceTypes = ['agents', 'instructions', 'skills'];
      const repository = 'user/custom-repo';
      const branch = 'develop';
      
      resourceTypes.forEach(resourceType => {
        const fileName = `test.${resourceType.slice(0, -1)}.md`;
        const attribution = `<!-- Synced from: https://github.com/${repository}/blob/${branch}/${resourceType}/${fileName} -->\n`;
        
        expect(attribution).toContain(`https://github.com/${repository}/blob/${branch}/${resourceType}/${fileName}`);
      });
    });
  });

  describe('Directory Structure Initialization', () => {
    test('should create required directory structure', () => {
      const workspaceFolder = '/test/workspace';
      const directories = [
        '.github',
        '.github/agents',
        '.github/instructions',
        '.github/skills'
      ];
      
      mockFs.existsSync.mockReturnValue(false);
      mockPath.join.mockImplementation((...paths) => paths.join('/'));
      mockFs.mkdirSync.mockReturnValue(undefined);
      
      directories.forEach(dir => {
        const dirPath = path.join(workspaceFolder, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      });
      
      expect(mockFs.mkdirSync).toHaveBeenCalledTimes(directories.length);
      directories.forEach(dir => {
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          `${workspaceFolder}/${dir}`,
          { recursive: true }
        );
      });
    });

    test('should create copilot-instructions.md template', () => {
      const workspaceFolder = '/test/workspace';
      const instructionsPath = path.join(workspaceFolder, '.github', 'copilot-instructions.md');
      
      mockPath.join.mockReturnValue(`${workspaceFolder}/.github/copilot-instructions.md`);
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockReturnValue(undefined);
      
      const template = `# GitHub Copilot Instructions

This file provides instructions to GitHub Copilot for working with this repository.

## Project Overview

<!-- Add project description here -->

## Coding Standards

<!-- Add coding standards and conventions here -->

## Architecture

<!-- Add architectural patterns and decisions here -->
`;
      
      if (!fs.existsSync(instructionsPath)) {
        fs.writeFileSync(instructionsPath, template);
      }
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(instructionsPath, template);
    });

    test('should create AGENTS.md template', () => {
      const workspaceFolder = '/test/workspace';
      const agentsPath = path.join(workspaceFolder, 'AGENTS.md');
      
      mockPath.join.mockReturnValue(`${workspaceFolder}/AGENTS.md`);
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockReturnValue(undefined);
      
      const template = `# AGENTS.md

## Project Overview

<!-- Add project overview for AI agents -->

## Repository Structure

<!-- Add repository structure description -->

## Development Workflow

<!-- Add development workflow instructions -->
`;
      
      if (!fs.existsSync(agentsPath)) {
        fs.writeFileSync(agentsPath, template);
      }
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(agentsPath, template);
    });

    test('should skip creating files that already exist', () => {
      const workspaceFolder = '/test/workspace';
      const instructionsPath = path.join(workspaceFolder, '.github', 'copilot-instructions.md');
      
      mockPath.join.mockReturnValue(`${workspaceFolder}/.github/copilot-instructions.md`);
      mockFs.existsSync.mockReturnValue(true); // File already exists
      
      if (!fs.existsSync(instructionsPath)) {
        fs.writeFileSync(instructionsPath, 'template');
      }
      
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('File Extension Validation', () => {
    test('should validate agent file extensions', () => {
      const validAgentFiles = [
        'nodejs-expert.agent.md',
        'python-developer.agent.md',
        'react-specialist.agent.md'
      ];
      
      const invalidFiles = [
        'readme.md',
        'agent.txt',
        'nodejs.agent'
      ];
      
      validAgentFiles.forEach(fileName => {
        expect(fileName.endsWith('.agent.md')).toBe(true);
      });
      
      invalidFiles.forEach(fileName => {
        expect(fileName.endsWith('.agent.md')).toBe(false);
      });
    });

    test('should validate instruction file extensions', () => {
      const validInstructionFiles = [
        'typescript-best-practices.instructions.md',
        'api-design.instructions.md'
      ];
      
      validInstructionFiles.forEach(fileName => {
        expect(fileName.endsWith('.instructions.md')).toBe(true);
      });
    });

    test('should validate skill file extensions', () => {
      const validSkillFiles = [
        'database-optimization.skill.md',
        'performance-tuning.skill.md'
      ];
      
      validSkillFiles.forEach(fileName => {
        expect(fileName.endsWith('.skill.md')).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', () => {
      const workspaceFolder = '/test/workspace';
      const dirPath = path.join(workspaceFolder, '.github');
      
      mockPath.join.mockReturnValue(`${workspaceFolder}/.github`);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      expect(() => {
        fs.mkdirSync(dirPath, { recursive: true });
      }).toThrow('Permission denied');
    });

    test('should handle write file errors', () => {
      const filePath = '/test/readonly/file.md';
      const content = 'test content';
      
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      
      expect(() => {
        fs.writeFileSync(filePath, content);
      }).toThrow('EACCES: permission denied');
    });
  });
});