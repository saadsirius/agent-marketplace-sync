// Mock VS Code API
/// <reference types="jest" />
import { jest } from '@jest/globals';

(global as any).vscode = {
  window: {
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    withProgress: jest.fn(),
    showTextDocument: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn(),
    workspaceFolders: [],
    openTextDocument: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  ConfigurationTarget: {
    Workspace: 2,
  },
  ProgressLocation: {
    Notification: 15,
  },
  Uri: {
    file: jest.fn(),
  },
} as any;