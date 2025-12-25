# Security Notes

## Current Status

After `npm install`, you may see:
- **3 high severity vulnerabilities** in dev dependencies
- **Deprecated package warnings** for eslint and related tools

## Vulnerability Details

The vulnerabilities are in:
- `glob` package (via `eslint-config-next`)
- **Severity**: High
- **Type**: Command injection in CLI tool
- **Impact**: Development only (not in production)

## Why This Is Safe

1. **Dev Dependencies Only**: These packages are only used during development, not in production builds
2. **CLI Tool Only**: The vulnerability is in the CLI tool, not the runtime code
3. **Next.js Limitation**: `eslint-config-next@14.2.0` requires `eslint@8.x`, which has this transitive dependency

## Options to Fix

### Option 1: Accept for Now (Recommended)
- These vulnerabilities don't affect production
- Wait for Next.js to update their dependencies
- Monitor with `npm audit` periodically

### Option 2: Force Update (Risky)
```bash
npm audit fix --force
```
**Warning**: This may break ESLint configuration and require manual fixes.

### Option 3: Remove ESLint (Not Recommended)
- Remove `eslint` and `eslint-config-next` from devDependencies
- Lose linting capabilities

## Recommendation

**Keep as-is for now**. These are dev-only vulnerabilities that don't impact:
- Production builds
- Runtime security
- End-user safety

When Next.js releases an update that fixes this, update your dependencies:
```bash
npm update eslint-config-next
```

## Monitoring

Check for updates periodically:
```bash
npm audit
npm outdated
```

## Production Deployment

When deploying to production:
- Only production dependencies are included
- Dev dependencies (including vulnerable ones) are excluded
- Your application is safe

---

**Last Updated**: Initial setup
**Next Review**: When Next.js releases updates

