import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/env'

/**
 * Browser-side Supabase client for Client Components and hooks.
 *
 * Uses the http-only cookie auth pattern so the access token is never exposed
 * to JavaScript running in the browser.
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
