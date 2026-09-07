// Authentication helpers for Ads Pro Enterprise
// Supabase Auth (replaces Clerk)

import { createClient } from '@/lib/supabase/server'

export interface Session {
  userId: string
  email?: string
  emailVerified?: boolean
}

/**
 * Returns the authenticated user's session from Supabase Auth, or `null` when
 * the request is unauthenticated. Auth state is read from the request cookies
 * via the server-side Supabase client.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return {
    userId: user.id,
    email: user.email ?? undefined,
    emailVerified: Boolean(user.email_confirmed_at),
  }
}
