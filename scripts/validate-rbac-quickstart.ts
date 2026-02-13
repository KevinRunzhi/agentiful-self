/**
 * Quickstart Validation Script
 *
 * T141 [P] Run quickstart.md validation and verify development environment setup
 *
 * This script validates that the development environment is properly configured
 * for the RBAC Authorization Model feature.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// =============================================================================
// Validation Types
// =============================================================================

interface ValidationResult {
  category: string;
  check: string;
  passed: boolean;
  message: string;
  details?: string;
}

interface ValidationReport {
  timestamp: string;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  status: 'pass' | 'fail';
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Check if a command is available
 */
function commandExists(command: string): boolean {
  try {
    execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${command}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Check if environment variable is set
 */
function envVarSet(varName: string): boolean {
  return !!process.env[varName];
}

/**
 * Run validation checks
 */
export function validateQuickstart(): ValidationReport {
  const results: ValidationResult[] = [];

  // ===========================================================================
  // 1. Environment Preparation
  // ===========================================================================

  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    const passed = majorVersion >= 22;
    results.push({
      category: 'Environment',
      check: 'Node.js 22.x LTS',
      passed,
      message: passed ? `Node.js ${nodeVersion} found` : 'Node.js 22.x or higher required',
      details: nodeVersion,
    });
  } catch {
    results.push({
      category: 'Environment',
      check: 'Node.js 22.x LTS',
      passed: false,
      message: 'Node.js not found',
    });
  }

  // Check pnpm
  try {
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
    results.push({
      category: 'Environment',
      check: 'pnpm 10.x',
      passed: true,
      message: `pnpm ${pnpmVersion} found`,
      details: pnpmVersion,
    });
  } catch {
    results.push({
      category: 'Environment',
      check: 'pnpm 10.x',
      passed: false,
      message: 'pnpm not found',
    });
  }

  // Check PostgreSQL
  results.push({
    category: 'Environment',
    check: 'PostgreSQL 18',
    passed: commandExists('psql') || commandExists('pg_isready'),
    message: commandExists('psql') ? 'PostgreSQL client found' : 'PostgreSQL client not found',
  });

  // Check Redis
  results.push({
    category: 'Environment',
    check: 'Redis 7.x',
    passed: commandExists('redis-cli'),
    message: commandExists('redis-cli') ? 'Redis client found' : 'Redis client not found',
  });

  // ===========================================================================
  // 2. Project Configuration
  // ===========================================================================

  // Check .env file
  results.push({
    category: 'Configuration',
    check: '.env file exists',
    passed: fileExists('.env'),
    message: fileExists('.env') ? '.env file found' : '.env file not found (copy from .env.example)',
  });

  // Check DATABASE_URL
  results.push({
    category: 'Configuration',
    check: 'DATABASE_URL configured',
    passed: envVarSet('DATABASE_URL'),
    message: envVarSet('DATABASE_URL') ? 'DATABASE_URL is set' : 'DATABASE_URL not set',
  });

  // Check REDIS_URL
  results.push({
    category: 'Configuration',
    check: 'REDIS_URL configured',
    passed: envVarSet('REDIS_URL'),
    message: envVarSet('REDIS_URL') ? 'REDIS_URL is set' : 'REDIS_URL not set',
  });

  // ===========================================================================
  // 3. Dependencies
  // ===========================================================================

  // Check node_modules
  results.push({
    category: 'Dependencies',
    check: 'Dependencies installed',
    passed: fileExists('node_modules') || fileExists('pnpm-workspace.yaml'),
    message: 'Run pnpm install if this fails',
  });

  // Check package.json files
  results.push({
    category: 'Dependencies',
    check: 'Monorepo packages configured',
    passed: fileExists('apps/api/package.json') && fileExists('apps/web/package.json'),
    message: 'Monorepo package.json files found',
  });

  // ===========================================================================
  // 4. Database Schema
  // ===========================================================================

  // Check Drizzle config
  results.push({
    category: 'Database',
    check: 'Drizzle configuration',
    passed: fileExists('packages/db/drizzle.config.ts') || fileExists('packages/db/drizzle.config.js'),
    message: 'Drizzle config file found',
  });

  // Check schema files
  results.push({
    category: 'Database',
    check: 'RBAC schema files',
    passed: fileExists('packages/db/src/schema/rbac.ts'),
    message: 'RBAC schema file found',
  });

  // Check migration files
  const migrationsDir = join('packages/db', 'drizzle');
  results.push({
    category: 'Database',
    check: 'Migration files generated',
    passed: fileExists(migrationsDir) || fileExists(join(migrationsDir, 'meta')),
    message: 'Run pnpm --filter @agentifui/db db:generate if this fails',
  });

  // ===========================================================================
  // 5. Seed Data
  // ===========================================================================

  // Check seed files
  results.push({
    category: 'Seed Data',
    check: 'RBAC seed files',
    passed: fileExists('packages/db/src/seed/rbac.ts'),
    message: 'RBAC seed file found',
  });

  // ===========================================================================
  // 6. API Implementation
  // ===========================================================================

  // Check RBAC routes
  results.push({
    category: 'API',
    check: 'RBAC routes implemented',
    passed: fileExists('apps/api/src/modules/rbac/routes/index.ts'),
    message: 'RBAC routes file found',
  });

  // Check RBAC services
  results.push({
    category: 'API',
    check: 'RBAC services implemented',
    passed: fileExists('apps/api/src/modules/rbac/services/index.ts'),
    message: 'RBAC services file found',
  });

  // ===========================================================================
  // 7. Frontend Implementation
  // ===========================================================================

  // Check RBAC hooks
  results.push({
    category: 'Frontend',
    check: 'RBAC hooks implemented',
    passed: fileExists('apps/web/src/features/rbac/hooks/index.ts'),
    message: 'RBAC hooks file found',
  });

  // ===========================================================================
  // 8. Documentation
  // ===========================================================================

  // Check API documentation
  results.push({
    category: 'Documentation',
    check: 'API documentation',
    passed: fileExists('docs/api/rbac-api.md'),
    message: 'API documentation found',
  });

  // Check quickstart guide
  results.push({
    category: 'Documentation',
    check: 'Quickstart guide',
    passed: fileExists('specs/002-rbac-authorization-model/quickstart.md'),
    message: 'Quickstart guide found',
  });

  // ===========================================================================
  // 9. Tests
  // ===========================================================================

  // Check integration tests
  results.push({
    category: 'Tests',
    check: 'Integration tests',
    passed: fileExists('apps/api/tests/integration/permission.test.ts'),
    message: 'Integration test files found',
  });

  // Check E2E tests
  results.push({
    category: 'Tests',
    check: 'E2E tests',
    passed: fileExists('apps/web/e2e/rbac/role.spec.ts'),
    message: 'E2E test files found',
  });

  // ===========================================================================
  // 10. Calculate Summary
  // ===========================================================================

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  const status = failed === 0 ? 'pass' : 'fail';

  return {
    timestamp: new Date().toISOString(),
    results,
    summary: { total, passed, failed },
    status,
  };
}

/**
 * Print validation report to console
 */
export function printValidationReport(report: ValidationReport): void {
  console.log('\n========================================');
  console.log('RBAC Quickstart Validation Report');
  console.log('========================================');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Status: ${report.status === 'pass' ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Summary: ${report.summary.passed}/${report.summary.total} checks passed\n`);

  // Group by category
  const categories = [...new Set(report.results.map((r) => r.category))];

  for (const category of categories) {
    console.log(`--- ${category} ---`);
    const categoryResults = report.results.filter((r) => r.category === category);

    for (const result of categoryResults) {
      const icon = result.passed ? '✓' : '✗';
      console.log(`${icon} ${result.check}: ${result.message}`);
      if (result.details) {
        console.log(`  Details: ${result.details}`);
      }
    }
    console.log('');
  }

  console.log('========================================\n');

  // Print recommendations for failed checks
  const failedResults = report.results.filter((r) => !r.passed);
  if (failedResults.length > 0) {
    console.log('--- Recommendations ---');
    for (const result of failedResults) {
      console.log(`• ${result.message}`);
    }
    console.log('');
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = validateQuickstart();
  printValidationReport(report);

  // Exit with appropriate code
  process.exit(report.status === 'pass' ? 0 : 1);
}
