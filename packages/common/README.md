# @charclaw/common

Shared utilities and types for upstream-agents packages. This package provides common functionality used across the monorepo, including agent configuration, SSE streaming, GitHub API helpers, and utility functions.

## Installation

This is an internal workspace package. It's automatically available to other packages in the monorepo:

```json
{
  "dependencies": {
    "@charclaw/common": "*"
  }
}
```

## Exports

### Agent Configuration

Defines supported AI coding agents, their providers, and model options.

```typescript
import {
  // Types
  type Agent,
  type ProviderName,
  type ModelOption,
  type UserCredentialFlags,
  // Data
  agentToProvider,
  agentLabels,
  agentModels,
  defaultAgentModel,
  // Functions
  getProviderForAgent,
  getDefaultAgent,
  hasClaudeCodeCredentials,
  hasCodexCredentials,
  hasGeminiCredentials,
  hasGooseCredentials,
  hasPiCredentials,
  hasCredentialsForModel,
  getDefaultModelForAgent,
  getModelLabel,
} from "@charclaw/common"
```

### SSE Utilities

Server-Sent Events helpers for real-time streaming.

```typescript
import {
  // Types
  type SSEEvent,
  type StreamController,
  type StreamOptions,
  type ProgressEvent,
  type ErrorEvent,
  type DoneEvent,
  type StreamEvent,
  // Constants
  SSE_HEADERS,
  // Server-side
  createSSEStream,
  sendProgress,
  sendError,
  sendDone,
  // Client-side
  parseSSEStream,
  waitForSSEResult,
} from "@charclaw/common"
```

### GitHub API Helpers

Type-safe GitHub API client utilities.

```typescript
import {
  // Types
  type GitHubApiError,
  type GitHubFetchOptions,
  type GitHubUser,
  type GitHubRepo,
  type GitHubBranch,
  type GitHubCompareResult,
  type GitHubPullRequest,
  // Core helpers
  githubFetch,
  githubFetchText,
  isGitHubApiError,
  // High-level API methods
  getUser,
  getUserRepos,
  getRepo,
  getRepoBranches,
  compareBranches,
  getDiff,
  createRepo,
  forkRepo,
  createPullRequest,
} from "@charclaw/common"
```

### Session Utilities

Helpers for building agent sessions and content blocks.

```typescript
import {
  mapToolName,
  buildSystemPrompt,
  buildContentBlocks,
  type BuildContentBlocksResult,
} from "@charclaw/common"
```

### Content Block Types

Types for structured agent responses.

```typescript
import type {
  ContentBlock,
  ToolCall,
  AgentStatus,
  AgentStatusResponse,
} from "@charclaw/common"
```

### Branch Utilities

Generate and validate Git branch names.

```typescript
import {
  // Constants
  BRANCH_NAME_WORDS,
  BRANCH_NAME_ERRORS,
  // Types
  type BranchNameWord,
  type BranchNameError,
  type BranchNameOptions,
  // Functions
  generateBranchName,
  randomBranchName,
  validateBranchName,
} from "@charclaw/common"
```

### Git Operations

Helpers for common Git operations.

```typescript
import {
  // Types
  type RebaseConflictState,
  type GitStatusResult,
  type MergeResult,
  type RebaseResult,
  type GitOperationContext,
  // Functions
  formatPRTitleFromBranch,
  formatPRBodyFromCommits,
  isGitNothingToCommitMessage,
  parseConflictedFiles,
  // Constants
  EMPTY_CONFLICT_STATE,
} from "@charclaw/common"
```

### Sandbox Utilities

```typescript
import { generateSandboxName } from "@charclaw/common"
```

### Slash Commands

Command definitions and fuzzy matching.

```typescript
import {
  type SlashCommand,
  SLASH_COMMANDS,
  fuzzyMatch,
  filterSlashCommands,
} from "@charclaw/common"
```

### Common Utilities

```typescript
import { cn, formatRelativeTime } from "@charclaw/common"
```

### Constants

```typescript
import { PATHS, SANDBOX_CONFIG, TIMEOUTS, ENV_VARS } from "@charclaw/common"
```

## Development

```bash
# Build the package
npm run build

# Type check
npm run typecheck
```

## License

MIT
