import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, {
      message: "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    }),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_ORG_ID: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    FACEBOOK_APP_ID: z.string().optional(),
    FACEBOOK_APP_SECRET: z.string().optional(),
    GOOGLE_ADS_CLIENT_ID: z.string().optional(),
    GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
    GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),
    GOOGLE_ANALYTICS_CLIENT_ID: z.string().optional(),
    GOOGLE_ANALYTICS_CLIENT_SECRET: z.string().optional(),
    GOOGLE_SEARCH_CONSOLE_CLIENT_ID: z.string().optional(),
    GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: z.string().optional(),
    TIKTOK_APP_ID: z.string().optional(),
    TIKTOK_APP_SECRET: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().optional(),
    REDIS_PASSWORD: z
      .string()
      .refine((val) => process.env.NODE_ENV !== "production" || (val != null && val.length > 0), {
        message: "REDIS_PASSWORD is required in production",
      })
      .optional(),
    REDIS_DB: z.string().optional(),
    TRUSTED_PROXY_HOPS: z
      .string()
      .regex(/^\d+$/, { message: "TRUSTED_PROXY_HOPS must be a non-negative integer" })
      .default("1"),
    INTERNAL_RATE_LIMIT_SECRET: z
      .string()
      .refine((val) => process.env.NODE_ENV !== "production" || (val != null && val.length >= 32), {
        message: "INTERNAL_RATE_LIMIT_SECRET is required in production and must be at least 32 characters",
      })
      .optional(),
    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .default("true"),
    META_MCP_URL: z.string().optional(),
    TIKTOK_MCP_URL: z.string().optional(),
    GOOGLE_MCP_URL: z.string().optional(),
    WOOCOMMERCE_URL: z.string().optional(),
    WOOCOMMERCE_KEY: z.string().optional(),
    WOOCOMMERCE_SECRET: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SITE_URL: z
      .string()
      .url()
      .refine(
        (val) =>
          process.env.NODE_ENV !== "production" ||
          (val != null && /^https:\/\//i.test(val)),
        { message: "NEXT_PUBLIC_SITE_URL is required in production and must be an HTTPS URL" },
      )
      .optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_ORG_ID: process.env.OPENAI_ORG_ID,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    GOOGLE_ANALYTICS_CLIENT_ID: process.env.GOOGLE_ANALYTICS_CLIENT_ID,
    GOOGLE_ANALYTICS_CLIENT_SECRET: process.env.GOOGLE_ANALYTICS_CLIENT_SECRET,
    GOOGLE_SEARCH_CONSOLE_CLIENT_ID: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
    GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
    TIKTOK_APP_ID: process.env.TIKTOK_APP_ID,
    TIKTOK_APP_SECRET: process.env.TIKTOK_APP_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    LOG_LEVEL: process.env.LOG_LEVEL,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_DB: process.env.REDIS_DB,
    TRUSTED_PROXY_HOPS: process.env.TRUSTED_PROXY_HOPS,
    INTERNAL_RATE_LIMIT_SECRET: process.env.INTERNAL_RATE_LIMIT_SECRET,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    META_MCP_URL: process.env.META_MCP_URL,
    TIKTOK_MCP_URL: process.env.TIKTOK_MCP_URL,
    GOOGLE_MCP_URL: process.env.GOOGLE_MCP_URL,
    WOOCOMMERCE_URL: process.env.WOOCOMMERCE_URL,
    WOOCOMMERCE_KEY: process.env.WOOCOMMERCE_KEY,
    WOOCOMMERCE_SECRET: process.env.WOOCOMMERCE_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" &&
    process.env.NODE_ENV !== "production",
}); 