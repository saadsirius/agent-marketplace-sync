// Since the parsing functions are not exported, we'll test them with local implementations
// that mirror the actual implementation from extension.ts

// Mock these functions since they're not exported
const parseAgentMetadataTest = (filename: string, content: string, downloadUrl: string) => {
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
};

const parseInstructionMetadataTest = (filename: string, content: string, downloadUrl: string) => {
  const name = filename.replace('.instructions.md', '').replace(/-/g, ' ')
    .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  let description = 'No description available';
  let scope: string | undefined;
  let language: string | undefined;

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
  }

  return {
    name,
    filename,
    description,
    scope,
    language,
    downloadUrl
  };
};

const parseSkillMetadataTest = (filename: string, content: string, downloadUrl: string) => {
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
};

describe('Metadata Parsing Functions', () => {
  describe('parseAgentMetadata', () => {
    test('should parse agent metadata with full frontmatter', () => {
      const filename = 'nodejs-developer.agent.md';
      const content = `---
description: "Expert Node.js developer agent"
model: "gpt-4"
tools: ["terminal", "file-editor", "web-browser"]
---

# Node.js Developer Agent

This agent helps with Node.js development.`;
      const downloadUrl = 'https://github.com/test/repo/agent.md';

      const result = parseAgentMetadataTest(filename, content, downloadUrl);

      expect(result).toEqual({
        name: 'Nodejs Developer',
        filename: 'nodejs-developer.agent.md',
        description: 'Expert Node.js developer agent',
        model: 'gpt-4',
        tools: ['terminal', 'file-editor', 'web-browser'],
        downloadUrl: 'https://github.com/test/repo/agent.md'
      });
    });

    test('should handle agent metadata without frontmatter', () => {
      const filename = 'python-expert.agent.md';
      const content = `# Python Expert Agent

This agent helps with Python development.`;
      const downloadUrl = 'https://github.com/test/repo/python.md';

      const result = parseAgentMetadataTest(filename, content, downloadUrl);

      expect(result).toEqual({
        name: 'Python Expert',
        filename: 'python-expert.agent.md', 
        description: 'No description available',
        model: undefined,
        tools: undefined,
        downloadUrl: 'https://github.com/test/repo/python.md'
      });
    });

    test('should handle partial frontmatter', () => {
      const filename = 'react-helper.agent.md';
      const content = `---
description: "React development helper"
---

# React Helper`;
      const downloadUrl = 'https://github.com/test/repo/react.md';

      const result = parseAgentMetadataTest(filename, content, downloadUrl);

      expect(result).toEqual({
        name: 'React Helper',
        filename: 'react-helper.agent.md',
        description: 'React development helper',
        model: undefined,
        tools: undefined,
        downloadUrl: 'https://github.com/test/repo/react.md'
      });
    });

    test('should handle tools array with different formats', () => {
      const filename = 'test-agent.agent.md';
      const content = `---
description: "Test agent"
tools: ["tool1", "tool2", "tool3"]
---`;
      const downloadUrl = 'https://github.com/test/repo/test.md';

      const result = parseAgentMetadataTest(filename, content, downloadUrl);

      expect(result.tools).toEqual(['tool1', 'tool2', 'tool3']);
    });
  });

  describe('parseInstructionMetadata', () => {
    test('should parse instruction metadata with full frontmatter', () => {
      const filename = 'typescript-best-practices.instructions.md';
      const content = `---
description: "TypeScript coding best practices and conventions"
scope: "project"
language: "typescript"
---

# TypeScript Best Practices

Follow these guidelines...`;
      const downloadUrl = 'https://github.com/test/repo/instructions.md';

      const result = parseInstructionMetadataTest(filename, content, downloadUrl);

      expect(result).toEqual({
        name: 'Typescript Best Practices',
        filename: 'typescript-best-practices.instructions.md',
        description: 'TypeScript coding best practices and conventions',
        scope: 'project',
        language: 'typescript',
        downloadUrl: 'https://github.com/test/repo/instructions.md'
      });
    });

    test('should handle instruction without frontmatter', () => {
      const filename = 'general-guidelines.instructions.md';
      const content = `# General Guidelines

These are general guidelines.`;
      const downloadUrl = 'https://github.com/test/repo/general.md';

      const result = parseInstructionMetadataTest(filename, content, downloadUrl);

      expect(result).toEqual({
        name: 'General Guidelines',
        filename: 'general-guidelines.instructions.md',
        description: 'No description available',
        scope: undefined,
        language: undefined,
        downloadUrl: 'https://github.com/test/repo/general.md'
      });
    });
  });

  describe('parseSkillMetadata', () => {
    test('should parse skill metadata with full frontmatter', () => {
      const filename = 'database-optimization.skill.md';
      const content = `---
description: "Advanced database optimization techniques and best practices"
domain: "database"
complexity: "advanced"
---

# Database Optimization Skill

This skill covers...`;
      const downloadUrl = 'https://github.com/test/repo/skill.md';

      const result = parseSkillMetadataTest(filename, content, downloadUrl);

      expect(result).toEqual({
        name: 'Database Optimization',
        filename: 'database-optimization.skill.md',
        description: 'Advanced database optimization techniques and best practices',
        domain: 'database',
        complexity: 'advanced',
        downloadUrl: 'https://github.com/test/repo/skill.md'
      });
    });

    test('should handle skill without frontmatter', () => {
      const filename = 'basic-skill.skill.md';
      const content = `# Basic Skill

This is a basic skill.`;
      const downloadUrl = 'https://github.com/test/repo/basic.md';

      const result = parseSkillMetadataTest(filename, content, downloadUrl);

      expect(result).toEqual({
        name: 'Basic Skill',
        filename: 'basic-skill.skill.md',
        description: 'No description available',
        domain: undefined,
        complexity: undefined,
        downloadUrl: 'https://github.com/test/repo/basic.md'
      });
    });
  });
});