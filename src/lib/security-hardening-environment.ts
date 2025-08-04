// Security Hardening & Environment Configuration - Phase 3 Week 10
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

// Security configuration interfaces
interface SecurityConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXSSProtection: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  passwordPolicy: PasswordPolicy;
  twoFactorAuth: boolean;
  auditLogging: boolean;
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  preventReuse: number;
  maxAge: number; // days
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: any) => string;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'Strict-Transport-Security'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId?: string;
  action: string;
  resource: string;
  ip: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface EnvironmentSecrets {
  encryptionKey: string;
  jwtSecret: string;
  databaseUrl: string;
  apiKeys: Record<string, string>;
  webhookSecrets: Record<string, string>;
}

// Security Hardening Manager
class SecurityHardeningManager {
  private static instance: SecurityHardeningManager;
  private config: SecurityConfig;
  private rateLimiters: Map<string, RateLimitConfig> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private encryptionKey: Buffer;

  constructor() {
    this.config = {
      enableCSP: true,
      enableHSTS: process.env.NODE_ENV === 'production',
      enableXSSProtection: true,
      enableReferrerPolicy: true,
      enablePermissionsPolicy: true,
      sessionTimeout: 3600000, // 1 hour
      maxLoginAttempts: 5,
      lockoutDuration: 900000, // 15 minutes
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        preventReuse: 5,
        maxAge: 90,
      },
      twoFactorAuth: process.env.NODE_ENV === 'production',
      auditLogging: true,
    };

    this.encryptionKey = this.deriveEncryptionKey();
    this.initializeRateLimiters();
    console.log('🔒 Security hardening initialized');
  }

  static getInstance(): SecurityHardeningManager {
    if (!SecurityHardeningManager.instance) {
      SecurityHardeningManager.instance = new SecurityHardeningManager();
    }
    return SecurityHardeningManager.instance;
  }

  private deriveEncryptionKey(): Buffer {
    const secret = process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production';
    return pbkdf2Sync(secret, 'ads-pro-enterprise-salt', 100000, 32, 'sha256');
  }

  private initializeRateLimiters(): void {
    // API rate limiting
    this.rateLimiters.set('api', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
      keyGenerator: (req) => req.ip || 'anonymous',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });

    // Authentication rate limiting
    this.rateLimiters.set('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
      keyGenerator: (req) => req.ip || 'anonymous',
      skipSuccessfulRequests: true,
      skipFailedRequests: false,
    });

    // Registration rate limiting
    this.rateLimiters.set('registration', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5,
      keyGenerator: (req) => req.ip || 'anonymous',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });
  }

  // Security headers generation
  generateSecurityHeaders(): SecurityHeaders {
    const headers: SecurityHeaders = {};

    if (this.config.enableCSP) {
      headers['Content-Security-Policy'] = this.generateCSPHeader();
    }

    if (this.config.enableHSTS) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    if (this.config.enableXSSProtection) {
      headers['X-XSS-Protection'] = '1; mode=block';
    }

    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-Frame-Options'] = 'DENY';

    if (this.config.enableReferrerPolicy) {
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    }

    if (this.config.enablePermissionsPolicy) {
      headers['Permissions-Policy'] = this.generatePermissionsPolicyHeader();
    }

    headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    headers['Cross-Origin-Resource-Policy'] = 'same-origin';

    return headers;
  }

  private generateCSPHeader(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self'",
      "object-src 'none'",
      "frame-src 'self' https://js.stripe.com",
      "worker-src 'self' blob:",
      "child-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "manifest-src 'self'",
      "connect-src 'self' https: wss: data:",
    ];

    return directives.join('; ');
  }

  private generatePermissionsPolicyHeader(): string {
    const policies = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'payment=(self)',
      'usb=()',
      'accelerometer=()',
      'autoplay=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'picture-in-picture=()',
    ];

    return policies.join(', ');
  }

  // Password security
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const policy = this.config.passwordPolicy;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check common passwords
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common, please choose a more secure password');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'shadow', 'sunshine', 'password1',
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  hashPassword(password: string): string {
    const salt = randomBytes(32).toString('hex');
    const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, hashedPassword: string): boolean {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return hash === verifyHash;
  }

  // Authentication security
  trackLoginAttempt(identifier: string, success: boolean, ip: string): { allowed: boolean; lockoutTime?: number } {
    const now = Date.now();
    let attempts = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };

    // Check if currently locked out
    if (attempts.lockedUntil && attempts.lockedUntil > now) {
      this.auditLog({
        action: 'login_attempt_blocked',
        resource: 'authentication',
        ip,
        userAgent: '',
        success: false,
        details: { identifier, reason: 'account_locked' },
        severity: 'medium',
      });

      return { allowed: false, lockoutTime: attempts.lockedUntil };
    }

    if (success) {
      // Reset attempts on successful login
      this.loginAttempts.delete(identifier);
      
      this.auditLog({
        action: 'login_success',
        resource: 'authentication',
        ip,
        userAgent: '',
        success: true,
        details: { identifier },
        severity: 'low',
      });

      return { allowed: true };
    } else {
      // Increment failed attempts
      attempts.count++;
      attempts.lastAttempt = now;

      if (attempts.count >= this.config.maxLoginAttempts) {
        attempts.lockedUntil = now + this.config.lockoutDuration;
        
        this.auditLog({
          action: 'account_locked',
          resource: 'authentication',
          ip,
          userAgent: '',
          success: false,
          details: { identifier, attempts: attempts.count },
          severity: 'high',
        });
      } else {
        this.auditLog({
          action: 'login_failed',
          resource: 'authentication',
          ip,
          userAgent: '',
          success: false,
          details: { identifier, attempts: attempts.count },
          severity: 'medium',
        });
      }

      this.loginAttempts.set(identifier, attempts);
      return { 
        allowed: !attempts.lockedUntil || attempts.lockedUntil <= now,
        lockoutTime: attempts.lockedUntil 
      };
    }
  }

  // Data encryption
  encrypt(data: string): string {
    const iv = randomBytes(16);
    const cipher = require('crypto').createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('ads-pro-enterprise'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = require('crypto').createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('ads-pro-enterprise'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Input sanitization
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>\"']/g, (char) => {
        const htmlEntities: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
        };
        return htmlEntities[char] || char;
      })
      .trim();
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validateURL(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  // SQL injection prevention
  escapeSQL(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  // Audit logging
  auditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    if (!this.config.auditLogging) return;

    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...entry,
    };

    this.auditLogs.push(logEntry);

    // Keep only recent logs (last 10,000 entries)
    if (this.auditLogs.length > 10000) {
      this.auditLogs.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${logEntry.action}: ${logEntry.resource} - ${logEntry.success ? 'SUCCESS' : 'FAILED'}`);
    }
  }

  // Environment security
  validateEnvironmentVariables(): { valid: boolean; missing: string[]; insecure: string[] } {
    const required = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'ENCRYPTION_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);
    const insecure: string[] = [];

    // Check for insecure values
    if (process.env.NEXTAUTH_SECRET === 'your-secret-here') {
      insecure.push('NEXTAUTH_SECRET is using default value');
    }

    if (process.env.ENCRYPTION_SECRET === 'default-secret-change-in-production') {
      insecure.push('ENCRYPTION_SECRET is using default value');
    }

    // Check for development values in production
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DATABASE_URL?.includes('localhost')) {
        insecure.push('DATABASE_URL points to localhost in production');
      }
    }

    return {
      valid: missing.length === 0 && insecure.length === 0,
      missing,
      insecure,
    };
  }

  secureEnvironmentSecrets(): EnvironmentSecrets {
    const secrets: EnvironmentSecrets = {
      encryptionKey: process.env.ENCRYPTION_SECRET || this.generateSecureSecret(64),
      jwtSecret: process.env.NEXTAUTH_SECRET || this.generateSecureSecret(32),
      databaseUrl: process.env.DATABASE_URL || '',
      apiKeys: {
        openai: process.env.OPENAI_API_KEY || '',
        anthropic: process.env.ANTHROPIC_API_KEY || '',
        stripe: process.env.STRIPE_SECRET_KEY || '',
      },
      webhookSecrets: {
        stripe: process.env.STRIPE_WEBHOOK_SECRET || '',
        github: process.env.GITHUB_WEBHOOK_SECRET || '',
      },
    };

    // Validate all secrets are present
    Object.entries(secrets).forEach(([key, value]) => {
      if (typeof value === 'string' && !value) {
        console.warn(`⚠️ Missing secret: ${key}`);
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (!subValue) {
            console.warn(`⚠️ Missing secret: ${key}.${subKey}`);
          }
        });
      }
    });

    return secrets;
  }

  private generateSecureSecret(length: number): string {
    return randomBytes(length).toString('hex');
  }

  // Token management
  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  generateCSRFToken(): string {
    return this.generateSecureToken(16);
  }

  validateCSRFToken(token: string, sessionToken: string): boolean {
    const expectedToken = createHash('sha256')
      .update(sessionToken + this.encryptionKey)
      .digest('hex')
      .substring(0, 32);
    
    return token === expectedToken;
  }

  // Rate limiting check
  checkRateLimit(type: string, key: string): { allowed: boolean; resetTime?: number } {
    const config = this.rateLimiters.get(type);
    if (!config) return { allowed: true };

    // This is a simplified rate limiter - in production, use Redis or similar
    const windowStart = Date.now() - config.windowMs;
    // Implementation would track requests per key/window
    
    return { allowed: true }; // Simplified for this implementation
  }

  // Security monitoring
  getSecurityMetrics(): {
    failedLogins: number;
    lockedAccounts: number;
    auditLogCount: number;
    recentThreats: AuditLogEntry[];
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const recentFailedLogins = this.auditLogs.filter(
      log => log.timestamp > oneHourAgo && 
             log.action === 'login_failed' && 
             !log.success
    ).length;

    const currentlyLocked = Array.from(this.loginAttempts.values())
      .filter(attempt => attempt.lockedUntil && attempt.lockedUntil > now).length;

    const recentThreats = this.auditLogs
      .filter(log => log.severity === 'high' || log.severity === 'critical')
      .slice(-10);

    return {
      failedLogins: recentFailedLogins,
      lockedAccounts: currentlyLocked,
      auditLogCount: this.auditLogs.length,
      recentThreats,
    };
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Configuration management
  updateSecurityConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('🔒 Security configuration updated');
  }

  getSecurityConfig(): SecurityConfig {
    return { ...this.config };
  }

  // Security audit report
  generateSecurityAuditReport(): string {
    const envValidation = this.validateEnvironmentVariables();
    const metrics = this.getSecurityMetrics();
    
    return `
# Security Audit Report

## Environment Security
- Valid Configuration: ${envValidation.valid ? '✅' : '❌'}
- Missing Variables: ${envValidation.missing.length}
- Security Issues: ${envValidation.insecure.length}

## Authentication Security
- Failed Logins (1h): ${metrics.failedLogins}
- Locked Accounts: ${metrics.lockedAccounts}
- Password Policy: Enforced (${this.config.passwordPolicy.minLength}+ chars)
- 2FA Enabled: ${this.config.twoFactorAuth ? '✅' : '❌'}

## Security Headers
- CSP Enabled: ${this.config.enableCSP ? '✅' : '❌'}
- HSTS Enabled: ${this.config.enableHSTS ? '✅' : '❌'}
- XSS Protection: ${this.config.enableXSSProtection ? '✅' : '❌'}

## Audit Logging
- Total Log Entries: ${metrics.auditLogCount}
- Recent Threats: ${metrics.recentThreats.length}
- Logging Enabled: ${this.config.auditLogging ? '✅' : '❌'}

## Recommendations
${envValidation.insecure.length > 0 ? '- Fix insecure environment variables' : ''}
${!this.config.twoFactorAuth ? '- Enable two-factor authentication' : ''}
${metrics.failedLogins > 100 ? '- Investigate high number of failed logins' : ''}
`;
  }
}

// Middleware factory for security headers
export function createSecurityMiddleware() {
  const securityManager = SecurityHardeningManager.getInstance();
  
  return (req: any, res: any, next: any) => {
    const headers = securityManager.generateSecurityHeaders();
    
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    next();
  };
}

// Export singleton instance
export const securityHardening = SecurityHardeningManager.getInstance();

// Export utilities
export const securityUtils = {
  // Generate secure password
  generateSecurePassword: (length: number = 16): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + symbols;
    
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
  },

  // Check if running in secure context
  isSecureContext: (): boolean => {
    return process.env.NODE_ENV === 'production' 
      ? (typeof window !== 'undefined' && window.isSecureContext)
      : true;
  },

  // Validate JWT token format
  isValidJWTFormat: (token: string): boolean => {
    return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token);
  },
};

// Export types and classes
export {
  SecurityHardeningManager,
  type SecurityConfig,
  type PasswordPolicy,
  type SecurityHeaders,
  type AuditLogEntry,
  type EnvironmentSecrets,
};