# Concurrent Development Setup

This repository uses `concurrently` with pnpm's built-in parallel execution to run multiple development servers simultaneously.

## Available Commands

### Run all dev servers
```bash
pnpm dev
```
This will automatically discover and run all packages that have a `dev` script defined in their `package.json`.

### Run specific subsets

**Apps only (web applications):**
```bash
pnpm dev:apps
```

**Agents only:**
```bash
pnpm dev:agents
```

**Custom filter:**
```bash
FILTER="your-package-name" pnpm dev:filter
# or multiple packages
FILTER="{package-a,package-b}" pnpm dev:filter
```

## How it works

The setup uses:
- `concurrently -k`: Manages multiple processes and kills all when one exits
- `pnpm -r`: Runs recursively across all workspace packages
- `--parallel`: Runs all matching scripts in parallel
- `--stream`: Streams output from all processes
- `--filter`: (optional) Filters which packages to run

## Benefits

1. **Zero configuration**: Automatically discovers all packages with dev scripts
2. **No manual maintenance**: Add new packages and they're automatically included
3. **Clean output**: Properly streamed and labeled output from each process
4. **Easy to stop**: Ctrl+C kills all processes cleanly

## Tips

- Use `pnpm dev:filter` with environment variables for custom package selections
- The output will show which package each log line comes from
- All processes are killed together when you stop the command (Ctrl+C)

## Troubleshooting

### Turbopack Issues in Monorepo

If you encounter "Next.js package not found" errors when using Turbopack (`--turbopack` or `--turbo` flags), this is due to Turbopack's current limitations with pnpm's symlink structure in monorepos.

**Solution:** Remove the Turbopack flags from your `dev` scripts:
```json
// Before (causes errors)
"dev": "next dev --turbopack"

// After (works correctly)
"dev": "next dev"
```

If you want to use Turbopack for specific packages, you can:
1. Create a separate script: `"dev:turbo": "next dev --turbopack"`
2. Run it individually: `pnpm -F your-package dev:turbo`

This is a known issue with Turbopack in pnpm monorepos and should be resolved in future Next.js releases. 