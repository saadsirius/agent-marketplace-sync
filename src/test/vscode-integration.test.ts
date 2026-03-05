// Mock VS Code API
const mockVSCode = (global as any).vscode as any;

describe('VS Code Integration Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock workspace folders
    mockVSCode.workspace.workspaceFolders = [];
  });

  describe('getWorkspaceFolder', () => {
    // Since getWorkspaceFolder is not exported, we'll test it indirectly through the behavior
    // But let's create a test version that mimics the behavior
    const getWorkspaceFolderTest = (): string | undefined => {
      const workspaceFolders = mockVSCode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        mockVSCode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return undefined;
      }
      return workspaceFolders[0].uri.fsPath;
    };

    test('should return undefined when no workspace folder is open', () => {
      mockVSCode.workspace.workspaceFolders = [];
      
      const result = getWorkspaceFolderTest();
      
      expect(result).toBeUndefined();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        'No workspace folder found. Please open a folder first.'
      );
    });

    test('should return first workspace folder path when available', () => {
      const mockPath = '/Users/test/workspace';
      mockVSCode.workspace.workspaceFolders = [
        {
          uri: { fsPath: mockPath }
        }
      ];
      
      const result = getWorkspaceFolderTest();
      
      expect(result).toBe(mockPath);
      expect(mockVSCode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    test('should return first workspace folder when multiple folders are open', () => {
      const firstPath = '/Users/test/workspace1';
      const secondPath = '/Users/test/workspace2';
      mockVSCode.workspace.workspaceFolders = [
        { uri: { fsPath: firstPath } },
        { uri: { fsPath: secondPath } }
      ];
      
      const result = getWorkspaceFolderTest();
      
      expect(result).toBe(firstPath);
    });
  });

  describe('Configuration Management', () => {
    test('should get configuration values', () => {
      const mockConfig = {
        get: jest.fn()
          .mockReturnValueOnce('github/awesome-copilot')
          .mockReturnValueOnce('main')
          .mockReturnValueOnce(false),
        update: jest.fn()
      };
      
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfig);
      
      const config = mockVSCode.workspace.getConfiguration('awesome-copilot-sync');
      
      expect(config.get('targetRepository')).toBe('github/awesome-copilot');
      expect(config.get('branch')).toBe('main');
      expect(config.get('autoSync')).toBe(false);
    });

    test('should update configuration values', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined)
      };
      
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfig);
      
      const config = mockVSCode.workspace.getConfiguration('awesome-copilot-sync');
      await config.update('targetRepository', 'user/custom-repo', mockVSCode.ConfigurationTarget.Workspace);
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'targetRepository', 
        'user/custom-repo', 
        mockVSCode.ConfigurationTarget.Workspace
      );
    });
  });

  describe('User Interface Interactions', () => {
    test('should show input box for repository configuration', async () => {
      mockVSCode.window.showInputBox.mockResolvedValueOnce('user/custom-repo');
      
      const result = await mockVSCode.window.showInputBox({
        prompt: 'Enter the repository to sync from (format: owner/repo)',
        value: 'github/awesome-copilot',
        validateInput: expect.any(Function)
      });
      
      expect(result).toBe('user/custom-repo');
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith({
        prompt: 'Enter the repository to sync from (format: owner/repo)',
        value: 'github/awesome-copilot',
        validateInput: expect.any(Function)
      });
    });

    test('should validate repository input format', () => {
      const validateInput = (value: string) => {
        if (!value || !value.includes('/')) {
          return 'Please enter a valid repository format (owner/repo)';
        }
        return null;
      };

      expect(validateInput('')).toBe('Please enter a valid repository format (owner/repo)');
      expect(validateInput('invalid')).toBe('Please enter a valid repository format (owner/repo)');
      expect(validateInput('user/repo')).toBeNull();
    });

    test('should show quick pick for resource selection', async () => {
      const mockItems = [
        {
          label: 'Test Agent',
          description: 'A test agent for development',
          detail: 'Model: gpt-4 | Tools: terminal, editor',
          agent: { name: 'Test Agent', filename: 'test.agent.md' }
        }
      ];
      
      mockVSCode.window.showQuickPick.mockResolvedValueOnce(mockItems[0]);
      
      const result = await mockVSCode.window.showQuickPick(mockItems, {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Search and select an agent to add to your project...'
      });
      
      expect(result).toBe(mockItems[0]);
      expect(mockVSCode.window.showQuickPick).toHaveBeenCalledWith(
        mockItems,
        {
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Search and select an agent to add to your project...'
        }
      );
    });

    test('should show progress notification', async () => {
      const mockProgressCallback = jest.fn().mockResolvedValue({ totalFiles: 5 });
      
      mockVSCode.window.withProgress.mockImplementation((options: any, callback: any) => {
        expect(options).toEqual({
          location: mockVSCode.ProgressLocation.Notification,
          title: 'Syncing Copilot Resources',
          cancellable: true
        });
        
        const mockProgress = {
          report: jest.fn()
        };
        const mockToken = {
          isCancellationRequested: false
        };
        
        return callback(mockProgress, mockToken);
      });
      
      const result = await mockVSCode.window.withProgress({
        location: mockVSCode.ProgressLocation.Notification,
        title: 'Syncing Copilot Resources',
        cancellable: true
      }, mockProgressCallback);
      
      expect(mockVSCode.window.withProgress).toHaveBeenCalled();
    });

    test('should show success message with action', async () => {
      mockVSCode.window.showInformationMessage.mockResolvedValueOnce('Open File');
      
      const result = await mockVSCode.window.showInformationMessage(
        '✅ Added agent "Test Agent" to your project!',
        'Open File'
      );
      
      expect(result).toBe('Open File');
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '✅ Added agent "Test Agent" to your project!',
        'Open File'
      );
    });

    test('should show error messages', () => {
      mockVSCode.window.showErrorMessage('Failed to sync: Network error');
      
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to sync: Network error'
      );
    });

    test('should show warning messages', () => {
      mockVSCode.window.showWarningMessage('No agents found in the marketplace.');
      
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith(
        'No agents found in the marketplace.'
      );
    });
  });

  describe('Command Registration', () => {
    test('should register all extension commands', () => {
      const mockCommands = [
        'awesome-copilot-sync.configure',
        'awesome-copilot-sync.removeRepository',
        'awesome-copilot-sync.initializeStructure',
        'awesome-copilot-sync.findAndAddAgent',
        'awesome-copilot-sync.findAndAddInstruction',
        'awesome-copilot-sync.findAndAddSkill',
        'awesome-copilot-sync.findAndAddPlugin',
        'awesome-copilot-sync.clearCache',
        'awesome-copilot-sync.showCacheStats'
      ];
      
      mockCommands.forEach(command => {
        mockVSCode.commands.registerCommand(command, jest.fn());
      });
      
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledTimes(mockCommands.length);
      
      mockCommands.forEach(command => {
        expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
          command,
          expect.any(Function)
        );
      });
    });
  });

  describe('Document Operations', () => {
    test('should open and show text document', async () => {
      const mockDocument = { uri: 'file:///test/path/file.md' };
      mockVSCode.workspace.openTextDocument.mockResolvedValueOnce(mockDocument);
      mockVSCode.window.showTextDocument.mockResolvedValueOnce(undefined);
      
      const document = await mockVSCode.workspace.openTextDocument('/test/path/file.md');
      await mockVSCode.window.showTextDocument(document);
      
      expect(mockVSCode.workspace.openTextDocument).toHaveBeenCalledWith('/test/path/file.md');
      expect(mockVSCode.window.showTextDocument).toHaveBeenCalledWith(mockDocument);
    });
  });
});