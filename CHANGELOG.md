# Changelog

All notable changes to the "awesome-copilot-sync" extension will be documented in this file.

## [1.2.1] - 2026-03-05

### Fixed
- Minor stability improvements and bug fixes

## [1.2.0] - 2026-03-05

### Added
- **Marketplace Sync**: New `Sync Marketplace` command to pull the latest marketplace index and resources
- **Find and Add Plugin**: New command to discover and install plugins from the marketplace

### Changed
- Renamed "Target Repository" to "Marketplace" throughout the UI to align with Copilot CLI terminology
- Unified disk caching strategy for improved performance and reliability
- Removed individual `Sync * Only` commands in favor of the unified `Sync Marketplace` flow

### Fixed
- Cache loading and invalidation issues
- Various stability improvements

## [1.0.0] - 2026-02-09

### Added
- Initial release of Awesome Copilot Sync extension
- Repository configuration with target repository and branch selection
- Project structure initialization command
- Selective syncing of agents, prompts, instructions, and skills
- Progress tracking with cancellable sync operations
- Automatic attribution headers for all synced files
- GitHub API integration for fetching repository contents
- Support for any repository following awesome-copilot structure
- VS Code settings integration for configuration management
- Command palette integration for all operations

### Features
- **Configure Repository**: Set custom target repositories and branches
- **Initialize Structure**: Create proper `.github/` directory structure
- **Selective Sync**: Choose specific resource types to sync
- **Attribution Tracking**: Automatic source attribution in synced files
- **Progress Feedback**: Real-time sync progress with cancellation support

### Supported File Types
- `.agent.md` files from `agents/` directory
- `.prompt.md` files from `prompts/` directory
- `.instructions.md` files from `instructions/` directory
- Skill folders with `SKILL.md` files from `skills/` directory

### Configuration Options
- `awesome-copilot-sync.targetRepository`: Repository to sync from
- `awesome-copilot-sync.branch`: Branch to sync from
- `awesome-copilot-sync.autoSync`: Auto-sync on workspace open
- `awesome-copilot-sync.syncOnSave`: Check for updates on file save

### Development Features
- TypeScript implementation for type safety
- Comprehensive error handling and user feedback
- Modular architecture for easy extension
- VS Code Extension Development Host support for debugging