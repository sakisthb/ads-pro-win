import { env } from '@/env';

export const config = {
  app: {
    name: 'Ads Pro Enterprise',
    version: '1.0.0',
    environment: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
  },
  database: {
    url: env.DATABASE_URL,
    host: env.DATABASE_URL ? new URL(env.DATABASE_URL).hostname : 'localhost',
    port: env.DATABASE_URL ? parseInt(new URL(env.DATABASE_URL).port) : 5432,
  },
  supabase: {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  auth: {
    clerk: {
      publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
      webhookSecret: env.CLERK_WEBHOOK_SECRET,
    },
  },
  ai: {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      organization: env.OPENAI_ORG_ID,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
    },
    google: {
      apiKey: env.GOOGLE_API_KEY,
    },
  },
  marketing: {
    facebook: {
      appId: env.FACEBOOK_APP_ID,
      appSecret: env.FACEBOOK_APP_SECRET,
    },
    google: {
      clientId: env.GOOGLE_ADS_CLIENT_ID,
      clientSecret: env.GOOGLE_ADS_CLIENT_SECRET,
      developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    },
    tiktok: {
      appId: env.TIKTOK_APP_ID,
      appSecret: env.TIKTOK_APP_SECRET,
    },
  },
  billing: {
    stripe: {
      publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    },
  },
  redis: {
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT || '6379'),
    password: env.REDIS_PASSWORD || undefined,
    db: parseInt(env.REDIS_DB || '0'),
  },
  monitoring: {
    sentry: {
      dsn: env.SENTRY_DSN,
    },
    logLevel: env.LOG_LEVEL || 'info',
  },
  features: {
    aiEnabled: !!env.OPENAI_API_KEY || !!env.ANTHROPIC_API_KEY,
    analyticsEnabled: true,
    cachingEnabled: true,
    realTimeEnabled: true,
  },
};

export function validateConfig() {
  const errors: string[] = [];

  // Required environment variables
  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required');
  }

  if (!env.CLERK_SECRET_KEY) {
    errors.push('CLERK_SECRET_KEY is required');
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }

  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }

  // Optional but recommended
  if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) {
    console.warn('No AI API keys configured - AI features will be disabled');
  }

  if (!env.REDIS_HOST) {
    console.warn('Redis not configured - caching will be disabled');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }

  return true;
}

export default config; 