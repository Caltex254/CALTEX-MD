# Contributing to CALTEX MD

First off, thank you for considering contributing to CALTEX MD! It's people like you that make this project great.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)
- [Testing Requirements](#testing-requirements)

---

## Code of Conduct

### Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- The use of sexualized language or imagery and unwelcome sexual attention or advances
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team at security@caltex-md.dev. All complaints will be reviewed and investigated and will result in a response that is deemed necessary and appropriate. The project team is obligated to maintain confidentiality with regard to the reporter of an incident.

---

## How to Contribute

### Fork and Branch Workflow

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/caltex-md.git
   cd caltex-md
   ```
3. **Add the upstream** remote:
   ```bash
   git remote add upstream https://github.com/caltex-md/caltex-md.git
   ```
4. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
   Branch naming conventions:
   - `feat/` - New features
   - `fix/` - Bug fixes
   - `docs/` - Documentation changes
   - `refactor/` - Code refactoring
   - `test/` - Adding or updating tests
   - `chore/` - Maintenance tasks

5. **Make your changes** and commit them
6. **Push** your branch to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
7. **Open a Pull Request** against the `main` branch

### Keeping Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

Resolve any conflicts, then force-push your branch:
```bash
git push origin feat/your-feature-name --force-with-lease
```

---

## Development Setup

### Prerequisites

- **Node.js** >= 20.x
- **Bun** >= 1.0 (recommended runtime)
- **Git** >= 2.x
- A code editor with TypeScript support (VS Code recommended)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/caltex-md/caltex-md.git
cd caltex-md

# Install dependencies
npm install
# or
bun install

# Copy environment variables
cp .env.example .env

# Set up the database
npx prisma db push
npx prisma generate

# Build the project
npm run build
```

### Running in Development Mode

```bash
# Start the dashboard in development mode (port 3000)
npm run dev

# Start the bot service in development mode (port 3031)
cd mini-services/caltex-bot
bun run dev

# Start the WebSocket service (port 3003)
cd mini-services/websocket-service
bun run dev
```

### Project Structure

```
caltex-md/
├── src/                          # Next.js dashboard source
│   ├── app/                      # App Router pages and API routes
│   │   └── api/                  # REST API endpoints
│   ├── components/               # React components
│   │   ├── dashboard/            # Dashboard-specific components
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/                      # Shared libraries
│   │   ├── commands/             # Plugin command modules
│   │   ├── auth.ts               # JWT authentication
│   │   ├── bot-client.ts         # Bot API client
│   │   ├── db.ts                 # Prisma database client
│   │   ├── plugin-loader.ts      # Plugin system
│   │   └── utils.ts              # Utility functions
│   ├── hooks/                    # React hooks
│   └── store/                    # Zustand state management
├── mini-services/
│   ├── caltex-bot/               # WhatsApp bot service
│   │   ├── index.ts              # Bot entry point
│   │   └── src/                  # Bot source modules
│   │       ├── ai-handler.ts     # AI integration
│   │       ├── anti-features.ts  # Anti-feature enforcement
│   │       ├── connection.ts     # WhatsApp connection
│   │       ├── group-manager.ts  # Group management
│   │       ├── media-handler.ts  # Media processing
│   │       ├── message-handler.ts# Message processing
│   │       ├── scheduler.ts      # Message scheduling
│   │       ├── session-manager.ts# Session management
│   │       └── types.ts          # Type definitions
│   └── websocket-service/        # WebSocket service
├── prisma/
│   └── schema.prisma             # Database schema
├── nginx/                        # Nginx configuration
├── Dockerfile                    # Dashboard Dockerfile
├── Dockerfile.bot                # Bot Dockerfile
├── docker-compose.yml            # Development compose
├── docker-compose.prod.yml       # Production compose
├── ecosystem.config.js           # PM2 configuration
└── Procfile                      # Heroku Procfile
```

---

## Code Style Guidelines

### TypeScript

- Use **TypeScript** for all new code (strict mode enabled)
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use explicit return types on exported functions
- Avoid `any` types; use `unknown` when the type is truly unknown
- Use `readonly` for properties that should not be mutated

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `message-handler.ts`)
- **Classes**: `PascalCase` (e.g., `MessageHandler`)
- **Functions/Methods**: `camelCase` (e.g., `handleMessage`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_CONFIG`)
- **Interfaces/Types**: `PascalCase` (e.g., `BotConfig`)
- **Environment variables**: `UPPER_SNAKE_CASE` (e.g., `BOT_API_URL`)
- **React components**: `PascalCase.tsx` (e.g., `OverviewPanel.tsx`)

### Code Organization

- One class/interface per file (export as default or named export)
- Group imports: Node built-ins, external packages, internal modules
- Keep functions focused and under 50 lines when possible
- Use descriptive variable and function names
- Add JSDoc comments for exported functions and classes

### Example

```typescript
// Good
import { createServer, IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';
import { SessionManager } from './session-manager';

const DEFAULT_PORT = 3031;

/**
 * Handles incoming HTTP requests for the bot API.
 */
export class RequestHandler {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly logger: pino.Logger
  ) {}

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Implementation
  }
}
```

### React Components

- Use functional components with hooks
- Use TypeScript for props interfaces
- Prefer `shadcn/ui` components for UI elements
- Use `lucide-react` for icons
- Follow the component file structure:
  1. Imports
  2. Type definitions
  3. Component definition
  4. Export

---

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring without feature changes |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, dependencies |
| `ci` | CI/CD configuration changes |

### Scopes

- `bot` - WhatsApp bot service
- `dashboard` - Next.js dashboard
- `api` - REST API endpoints
- `ai` - AI integration
- `plugin` - Plugin system
- `db` - Database/Prisma
| `docker` - Docker configuration
| `ws` - WebSocket service
| `auth` - Authentication
| `media` - Media handling
| `mod` - Moderation/anti-features
| `schedule` - Scheduled messages

### Examples

```bash
feat(bot): add anti-tag feature with configurable max mentions
fix(api): resolve JWT token expiration not being checked properly
docs(readme): update deployment instructions for Oracle Cloud
refactor(ai): extract provider-specific logic into separate methods
perf(bot): optimize message processing pipeline for high-volume chats
test(api): add integration tests for session management endpoints
chore(deps): update Baileys to v6.7.8
ci(docker): add health check to Docker Compose configuration
```

### Breaking Changes

Indicate breaking changes in the footer:

```
feat(api): change authentication to JWT-only

BREAKING CHANGE: API key authentication has been removed.
All requests must now use JWT Bearer tokens.
```

---

## Pull Request Process

### Before Submitting

1. **Rebase** your branch on the latest `main`
2. **Run the linter**: `npm run lint`
3. **Build successfully**: `npm run build`
4. **Test your changes** thoroughly
5. **Update documentation** if you changed behavior

### PR Checklist

- [ ] My code follows the project's code style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new lint warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] I have updated the CHANGELOG.md with my changes

### PR Title

Use the same format as commit messages:
```
feat(bot): add scheduled message recurring support
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## How Has This Been Tested?
Describe the tests you ran and how to reproduce them.

## Screenshots (if applicable)
Add screenshots for UI changes.

## Related Issues
Closes #123
```

### Review Process

1. At least one maintainer must approve the PR
2. All CI checks must pass
3. No merge conflicts with `main`
4. PR will be squashed and merged

---

## Bug Reports

### Before Submitting a Bug Report

1. **Search existing issues** to avoid duplicates
2. **Test with the latest version** to ensure the bug hasn't been fixed
3. **Gather information**: OS, Node.js version, Docker version, etc.

### Bug Report Template

```markdown
## Bug Description
A clear and concise description of what the bug is.

## Steps to Reproduce
1. Start the bot with `npm start`
2. Send `!ai hello` in a group chat
3. Observe the error in the logs

## Expected Behavior
The bot should respond with an AI-generated reply.

## Actual Behavior
The bot returns "❌ AI request failed. Please try again later."

## Environment
- OS: Ubuntu 22.04
- Node.js version: 20.11.0
- Bun version: 1.1.0
- Docker: Yes/No
- Bot version: 1.0.0

## Logs
```
Paste relevant log output here
```

## Additional Context
Any other context about the problem (configuration, environment variables, etc.)

## Possible Solution
If you have suggestions on how to fix the bug, include them here.
```

---

## Feature Requests

### Feature Request Template

```markdown
## Problem Statement
A clear description of the problem this feature would solve.
Example: I'm always frustrated when [...]

## Proposed Solution
A clear description of what you want to happen.

## Alternatives Considered
A clear description of any alternative solutions you've considered.

## Additional Context
Any other context, screenshots, or references.

## Would you be willing to implement this?
- [ ] Yes, I'd like to submit a PR for this feature
```

---

## Testing Requirements

### Unit Tests

All new features and bug fixes should include unit tests:

```bash
# Run all tests
npm test

# Run tests for a specific file
npm test -- message-handler.test.ts

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

```
src/
└── lib/
    └── commands/
        └── __tests__/
            ├── ai.test.ts
            ├── fun.test.ts
            └── moderation.test.ts
```

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MessageHandler } from '../message-handler';

describe('MessageHandler', () => {
  describe('handleMessage', () => {
    it('should process a valid command message', async () => {
      // Arrange
      const handler = new MessageHandler(/* mocks */);
      const mockData = { messages: [/* ... */], type: 'notify' };

      // Act
      await handler.handleMessage(mockSocket, mockData, 'test-session');

      // Assert
      expect(mockSocket.sendMessage).toHaveBeenCalled();
    });

    it('should ignore messages from self', async () => {
      // Test implementation
    });

    it('should reject commands from blocked JIDs', async () => {
      // Test implementation
    });
  });
});
```

### Test Guidelines

- **Arrange-Act-Assert** pattern for all tests
- Mock external dependencies (Baileys socket, AI providers, database)
- Test both happy paths and error cases
- Test edge cases (empty input, null values, boundary conditions)
- Use descriptive test names that explain the expected behavior
- Aim for at least 80% code coverage on new code
- Integration tests for API endpoints

### Manual Testing Checklist

For changes that affect the bot's WhatsApp behavior:

- [ ] Bot connects successfully and displays QR code
- [ ] Commands respond correctly with expected output
- [ ] Anti-features enforce correctly in groups
- [ ] AI commands work with configured provider
- [ ] Scheduled messages send at the correct time
- [ ] Dashboard displays accurate real-time data
- [ ] Session persistence works across restarts
- [ ] Media handling works for all supported types

---

Thank you for contributing to CALTEX MD! 🎉
