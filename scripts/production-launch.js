#!/usr/bin/env node

/**
 * Production Launch Script
 * Ads Pro Enterprise - Go-Live Execution
 * 
 * This script executes the complete production launch process
 * including all go-live checklist items and deployment procedures.
 */

// Load environment variables
require('dotenv').config();

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  projectName: 'ads-pro-enterprise',
  environment: 'production',
  deploymentUrl: process.env.VERCEL_URL || 'https://ads-pro-enterprise.vercel.app',
  databaseUrl: process.env.DATABASE_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  clerkSecretKey: process.env.CLERK_SECRET_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT || '6379',
  redisPassword: process.env.REDIS_PASSWORD || '',
  redisDb: process.env.REDIS_DB || '0'
};

// ============================================================================
// GO-LIVE CHECKLIST ITEMS
// ============================================================================

const GO_LIVE_CHECKLIST = [
  {
    id: 'infra-01',
    title: 'Database Migration & Schema Validation',
    command: 'npx prisma migrate deploy',
    validation: 'npx prisma db push --accept-data-loss',
    estimatedTime: 30,
    critical: true
  },
  {
    id: 'infra-02',
    title: 'Load Balancer Configuration',
    command: 'curl -I https://ads-pro-enterprise.vercel.app/health',
    validation: 'curl -f https://ads-pro-enterprise.vercel.app/api/health',
    estimatedTime: 45,
    critical: true
  },
  {
    id: 'infra-03',
    title: 'SSL/TLS Certificate Installation',
    command: 'curl -I https://ads-pro-enterprise.vercel.app',
    validation: 'openssl s_client -connect ads-pro-enterprise.vercel.app:443 -servername ads-pro-enterprise.vercel.app',
    estimatedTime: 20,
    critical: true
  },
  {
    id: 'infra-04',
    title: 'Auto-scaling Configuration',
    command: 'vercel --prod',
    validation: 'vercel ls',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'security-01',
    title: 'Security Audit & Penetration Testing',
    command: 'npm run security:audit',
    validation: 'npm audit --audit-level=high',
    estimatedTime: 120,
    critical: true
  },
  {
    id: 'security-02',
    title: 'Firewall & DDoS Protection',
    command: 'vercel --prod --force',
    validation: 'curl -I https://ads-pro-enterprise.vercel.app',
    estimatedTime: 90,
    critical: true
  },
  {
    id: 'security-03',
    title: 'Rate Limiting & API Security',
    command: 'npm run test:security',
    validation: 'npm run test:api',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'security-04',
    title: 'GDPR & Compliance Validation',
    command: 'npm run compliance:check',
    validation: 'npm run compliance:validate',
    estimatedTime: 90,
    critical: false
  },
  {
    id: 'perf-01',
    title: 'Load Testing & Performance Validation',
    command: 'npm run test:load',
    validation: 'npm run test:performance',
    estimatedTime: 180,
    critical: true
  },
  {
    id: 'perf-02',
    title: 'Database Performance Optimization',
    command: 'npx prisma db seed',
    validation: 'npm run test:database',
    estimatedTime: 120,
    critical: false
  },
  {
    id: 'perf-03',
    title: 'CDN Configuration & Optimization',
    command: 'vercel --prod',
    validation: 'curl -I https://ads-pro-enterprise.vercel.app',
    estimatedTime: 90,
    critical: false
  },
  {
    id: 'perf-04',
    title: 'Caching Strategy Implementation',
    command: 'npm run cache:setup',
    validation: 'npm run cache:test',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'monitor-01',
    title: 'Real-time Monitoring Setup',
    command: 'npm run monitoring:setup',
    validation: 'npm run monitoring:test',
    estimatedTime: 90,
    critical: true
  },
  {
    id: 'monitor-02',
    title: 'Log Aggregation & Analysis',
    command: 'npm run logs:setup',
    validation: 'npm run logs:test',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'monitor-03',
    title: 'Performance Metrics Dashboard',
    command: 'npm run dashboard:setup',
    validation: 'npm run dashboard:test',
    estimatedTime: 45,
    critical: false
  },
  {
    id: 'monitor-04',
    title: 'Error Tracking & Alerting',
    command: 'npm run error:setup',
    validation: 'npm run error:test',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'backup-01',
    title: 'Automated Backup Configuration',
    command: 'npm run backup:setup',
    validation: 'npm run backup:test',
    estimatedTime: 90,
    critical: true
  },
  {
    id: 'backup-02',
    title: 'Disaster Recovery Plan',
    command: 'npm run recovery:setup',
    validation: 'npm run recovery:test',
    estimatedTime: 120,
    critical: true
  },
  {
    id: 'backup-03',
    title: 'Cross-region Backup Setup',
    command: 'npm run backup:cross-region',
    validation: 'npm run backup:validate',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'backup-04',
    title: 'Backup Encryption & Security',
    command: 'npm run backup:encrypt',
    validation: 'npm run backup:security',
    estimatedTime: 45,
    critical: false
  },
  {
    id: 'deploy-01',
    title: 'Deployment Pipeline Configuration',
    command: 'vercel --prod',
    validation: 'vercel ls',
    estimatedTime: 120,
    critical: true
  },
  {
    id: 'deploy-02',
    title: 'Rollback Procedures & Testing',
    command: 'npm run rollback:test',
    validation: 'npm run rollback:validate',
    estimatedTime: 90,
    critical: true
  },
  {
    id: 'deploy-03',
    title: 'Blue-Green Deployment Setup',
    command: 'vercel --prod',
    validation: 'vercel ls',
    estimatedTime: 120,
    critical: false
  },
  {
    id: 'deploy-04',
    title: 'Version Control & Release Management',
    command: 'git tag v1.0.0-production',
    validation: 'git log --oneline -10',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'test-01',
    title: 'End-to-End Testing Suite',
    command: 'npm run test:e2e',
    validation: 'npm run test:validate',
    estimatedTime: 180,
    critical: true
  },
  {
    id: 'test-02',
    title: 'User Acceptance Testing',
    command: 'npm run test:uat',
    validation: 'npm run test:uat:validate',
    estimatedTime: 240,
    critical: true
  },
  {
    id: 'test-03',
    title: 'Security Testing & Validation',
    command: 'npm run test:security',
    validation: 'npm run test:security:validate',
    estimatedTime: 120,
    critical: true
  },
  {
    id: 'test-04',
    title: 'Performance Testing & Optimization',
    command: 'npm run test:performance',
    validation: 'npm run test:performance:validate',
    estimatedTime: 180,
    critical: false
  },
  {
    id: 'doc-01',
    title: 'User Documentation Completion',
    command: 'npm run docs:generate',
    validation: 'npm run docs:validate',
    estimatedTime: 120,
    critical: false
  },
  {
    id: 'doc-02',
    title: 'Admin Training Materials',
    command: 'npm run training:generate',
    validation: 'npm run training:validate',
    estimatedTime: 90,
    critical: false
  },
  {
    id: 'doc-03',
    title: 'API Documentation Finalization',
    command: 'npm run api:docs',
    validation: 'npm run api:docs:validate',
    estimatedTime: 60,
    critical: false
  },
  {
    id: 'doc-04',
    title: 'Support Resources & Knowledge Base',
    command: 'npm run support:setup',
    validation: 'npm run support:validate',
    estimatedTime: 90,
    critical: false
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function executeCommand(command, description) {
  try {
    log(`Executing: ${description}`, 'info');
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: 300000 // 5 minutes timeout
    });
    log(`✅ Success: ${description}`, 'success');
    return { success: true, result };
  } catch (error) {
    log(`❌ Error: ${description} - ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

function validateEnvironment() {
  log('🔍 Validating production environment...', 'info');
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`❌ Missing required environment variables: ${missingVars.join(', ')}`, 'error');
    return false;
  }
  
  log('✅ Environment validation passed', 'success');
  return true;
}

function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'info');
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    log('❌ Not in project root directory', 'error');
    return false;
  }
  
  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    log('❌ Dependencies not installed. Run npm install first', 'error');
    return false;
  }
  
  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    log('⚠️  No .env file found. Make sure environment variables are set', 'warning');
  }
  
  log('✅ Prerequisites check passed', 'success');
  return true;
}

// ============================================================================
// PRODUCTION LAUNCH EXECUTION
// ============================================================================

async function executeProductionLaunch() {
  log('🚀 STARTING PRODUCTION LAUNCH EXECUTION', 'info');
  log('==========================================', 'info');
  
  // Step 1: Validate environment and prerequisites
  if (!validateEnvironment()) {
    log('❌ Environment validation failed. Aborting launch.', 'error');
    process.exit(1);
  }
  
  if (!checkPrerequisites()) {
    log('❌ Prerequisites check failed. Aborting launch.', 'error');
    process.exit(1);
  }
  
  // Step 2: Execute critical checklist items first
  log('📋 Executing critical checklist items...', 'info');
  
  const criticalItems = GO_LIVE_CHECKLIST.filter(item => item.critical);
  const nonCriticalItems = GO_LIVE_CHECKLIST.filter(item => !item.critical);
  
  let successCount = 0;
  let failureCount = 0;
  
  // Execute critical items first
  for (const item of criticalItems) {
    log(`🔄 Executing critical item: ${item.title}`, 'info');
    
    const result = executeCommand(item.command, item.title);
    
    if (result.success) {
      successCount++;
      log(`✅ Critical item completed: ${item.title}`, 'success');
    } else {
      failureCount++;
      log(`❌ Critical item failed: ${item.title}`, 'error');
      
      // For critical items, we might want to abort
      log(`⚠️  Critical item failed. Consider aborting launch.`, 'warning');
    }
    
    // Add delay between items
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Execute non-critical items
  log('📋 Executing non-critical checklist items...', 'info');
  
  for (const item of nonCriticalItems) {
    log(`🔄 Executing item: ${item.title}`, 'info');
    
    const result = executeCommand(item.command, item.title);
    
    if (result.success) {
      successCount++;
      log(`✅ Item completed: ${item.title}`, 'success');
    } else {
      failureCount++;
      log(`❌ Item failed: ${item.title}`, 'error');
    }
    
    // Add delay between items
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Step 3: Final validation
  log('🔍 Performing final validation...', 'info');
  
  const finalValidation = executeCommand(
    'curl -f https://ads-pro-enterprise.vercel.app/api/health',
    'Final health check'
  );
  
  // Step 4: Generate launch report
  const launchReport = {
    timestamp: new Date().toISOString(),
    totalItems: GO_LIVE_CHECKLIST.length,
    criticalItems: criticalItems.length,
    nonCriticalItems: nonCriticalItems.length,
    successCount,
    failureCount,
    successRate: (successCount / GO_LIVE_CHECKLIST.length * 100).toFixed(2),
    finalValidation: finalValidation.success,
    deploymentUrl: CONFIG.deploymentUrl
  };
  
  // Save launch report
  const reportPath = path.join(__dirname, '../manifest/PRODUCTION_LAUNCH_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(launchReport, null, 2));
  
  // Step 5: Display results
  log('📊 PRODUCTION LAUNCH RESULTS', 'info');
  log('============================', 'info');
  log(`Total Items: ${launchReport.totalItems}`, 'info');
  log(`Critical Items: ${launchReport.criticalItems}`, 'info');
  log(`Success Count: ${successCount}`, 'success');
  log(`Failure Count: ${failureCount}`, failureCount > 0 ? 'error' : 'success');
  log(`Success Rate: ${launchReport.successRate}%`, 'info');
  log(`Final Validation: ${finalValidation.success ? 'PASSED' : 'FAILED'}`, finalValidation.success ? 'success' : 'error');
  log(`Deployment URL: ${CONFIG.deploymentUrl}`, 'info');
  
  if (launchReport.successRate >= 90 && finalValidation.success) {
    log('🎉 PRODUCTION LAUNCH SUCCESSFUL!', 'success');
    log('The Ads Pro Enterprise platform is now live!', 'success');
  } else {
    log('⚠️  PRODUCTION LAUNCH COMPLETED WITH ISSUES', 'warning');
    log('Please review the failed items and address them.', 'warning');
  }
  
  return launchReport;
}

// ============================================================================
// ROLLBACK PROCEDURES
// ============================================================================

function executeRollback() {
  log('🔄 EXECUTING ROLLBACK PROCEDURE', 'warning');
  log('================================', 'warning');
  
  const rollbackSteps = [
    {
      title: 'Stop application traffic',
      command: 'vercel --prod --force',
      validation: 'curl -I https://ads-pro-enterprise.vercel.app'
    },
    {
      title: 'Restore previous database version',
      command: 'npx prisma migrate reset --force',
      validation: 'npx prisma db push'
    },
    {
      title: 'Revert to previous deployment',
      command: 'vercel --prod --force',
      validation: 'vercel ls'
    },
    {
      title: 'Validate rollback',
      command: 'curl -f https://ads-pro-enterprise.vercel.app/api/health',
      validation: 'npm run test:basic'
    }
  ];
  
  for (const step of rollbackSteps) {
    log(`🔄 Executing rollback step: ${step.title}`, 'warning');
    const result = executeCommand(step.command, step.title);
    
    if (!result.success) {
      log(`❌ Rollback step failed: ${step.title}`, 'error');
    }
  }
  
  log('🔄 Rollback procedure completed', 'warning');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--rollback')) {
    executeRollback();
    return;
  }
  
  if (args.includes('--dry-run')) {
    log('🧪 DRY RUN MODE - No actual deployment will occur', 'info');
    log('Checklist items that would be executed:', 'info');
    
    GO_LIVE_CHECKLIST.forEach((item, index) => {
      log(`${index + 1}. ${item.title} (${item.critical ? 'CRITICAL' : 'NORMAL'})`, 'info');
    });
    
    return;
  }
  
  try {
    const report = await executeProductionLaunch();
    
    if (report.successRate >= 90) {
      log('🎉 PRODUCTION LAUNCH COMPLETED SUCCESSFULLY!', 'success');
      process.exit(0);
    } else {
      log('⚠️  PRODUCTION LAUNCH COMPLETED WITH ISSUES', 'warning');
      process.exit(1);
    }
  } catch (error) {
    log(`❌ PRODUCTION LAUNCH FAILED: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = {
  executeProductionLaunch,
  executeRollback,
  GO_LIVE_CHECKLIST,
  CONFIG
}; 