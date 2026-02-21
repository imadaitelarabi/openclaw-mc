# Contributing to OpenClaw MC

Thank you for your interest in contributing to OpenClaw MC! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Getting Started

OpenClaw MC is a Next.js-based web application that provides a real-time monitoring and management interface for OpenClaw Gateway. Before contributing, please:

1. Read the [README.md](./README.md) to understand the project
2. Check existing [issues](https://github.com/imadaitelarabi/openclaw-mc/issues) and [pull requests](https://github.com/imadaitelarabi/openclaw-mc/pulls)
3. For major changes, open an issue first to discuss your proposal

## Development Setup

### Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **OpenClaw Gateway**: A running instance (local or remote)
- **Git**: For version control

### Initial Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/YOUR_USERNAME/openclaw-mc.git
   cd openclaw-mc
   ```

2. **Install Dependencies**

   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configure Environment** (Optional)

   Copy the example environment file:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` with your gateway details:

   ```env
   OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
   OPENCLAW_GATEWAY_TOKEN=your_gateway_token_here
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

   The application will be available at http://localhost:3000

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications

### Making Changes

1. Make your changes in focused, logical commits
2. Test your changes locally
3. Ensure the code builds without errors:
   ```bash
   npm run build
   ```
4. Run the linter:
   ```bash
   npm run lint
   ```

### Commit Messages

Write clear, concise commit messages following this format:

```
<type>: <short summary>

<optional detailed description>
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**

```
feat: add gateway connection wizard for first-time users

fix: prevent memory leak in WebSocket reconnection logic

docs: update README with Docker deployment instructions
```

## Code Style Guidelines

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Follow the existing code patterns in the project
- Use **functional components** and **hooks** for React components
- Prefer **arrow functions** for component definitions
- Use **const** for variables that don't change, **let** otherwise (avoid **var**)

### React Components

```typescript
// Good: Functional component with proper typing
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState<string>('');

  return (
    <div>
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

### Styling

- Use **Tailwind CSS** utility classes
- Follow the existing design patterns and color scheme
- Maintain responsive design (mobile-first approach)
- Use semantic class names when creating custom components

### File Organization

- Place components in appropriate directories under `components/`
- Keep related files together (component, types, utilities)
- Use index files for cleaner imports

### Naming Conventions

- **Components**: PascalCase (e.g., `GatewaySetup.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useGatewayWebSocket.ts`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Types/Interfaces**: PascalCase (e.g., `ExtensionManifest`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)

## Pull Request Process

### Before Submitting

1. **Update your branch** with the latest main:

   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Ensure all checks pass:**
   - Build succeeds: `npm run build`
   - Linting passes: `npm run lint`
   - Code is formatted correctly

3. **Test thoroughly:**
   - Test your changes in development mode
   - Verify existing functionality still works
   - Test on both desktop and mobile viewports

### Submitting the PR

1. **Push your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub with:
   - **Clear title** describing the change
   - **Description** including:
     - What problem does this solve?
     - What changes were made?
     - How to test the changes
     - Screenshots (for UI changes)
     - Related issue number (if applicable)

3. **Template:**

   ```markdown
   ## Description

   Brief description of changes

   ## Related Issue

   Fixes #123

   ## Changes Made

   - Added feature X
   - Fixed bug Y
   - Updated documentation

   ## Testing

   - [ ] Tested locally in dev mode
   - [ ] Tested build
   - [ ] Tested on mobile viewport
   - [ ] Ran linter

   ## Screenshots

   (if applicable)
   ```

### Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged

## Testing

### Manual Testing

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Test the following scenarios:
   - Gateway connection/disconnection
   - Agent selection and chat
   - Panel management (open, close, switch)
   - Model and settings changes
   - Extension functionality
   - Mobile responsive behavior

### Build Testing

```bash
npm run build
npm start
```

Verify that the production build works correctly.

## Project Structure

```
openclaw-mc/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main application page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── agents/           # Agent-related components
│   ├── chat/             # Chat interface components
│   ├── gateway/          # Gateway setup components
│   ├── layout/           # Layout components (StatusBar)
│   ├── mobile/           # Mobile-specific components
│   ├── panels/           # Panel system components
│   └── statusbar/        # Status bar controls
├── contexts/             # React contexts
│   ├── PanelContext.tsx  # Panel management
│   └── ExtensionContext.tsx # Extension system
├── extensions/           # Extension implementations
│   ├── github/          # GitHub extension
│   └── _template/       # Extension template
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── extension-registry.ts  # Extension system
│   ├── ui-state-db.ts        # IndexedDB storage
│   └── utils.ts              # General utilities
├── server/               # Backend server code
│   ├── index.ts         # Main server entry
│   └── gateway/         # Gateway connection logic
├── types/                # TypeScript type definitions
└── docs/                 # Documentation

```

## Extensions System

If you're contributing an extension, please review:

- [Extension Template](./extensions/_template/)
- [Extension Types](./types/extension.ts)
- [Extension Registry](./lib/extension-registry.ts)

### Extension Guidelines

- Extensions must be **read-only** (no mutations)
- Follow the manifest schema strictly
- Implement proper error handling
- Document your extension's API requirements
- Test with and without valid credentials

## Getting Help

- **Documentation**: Check the [docs/](./docs) directory
- **Issues**: Search existing issues or create a new one
- **Discord**: Join the OpenClaw Discord community

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow the project's coding standards

## License

By contributing to OpenClaw MC, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to OpenClaw MC! 🚀
