import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/env'

/**
 * Server-side Supabase client for the Next.js App Router.
 *
 * Auth state is read from (and written to) the request cookies, so this client
 * works inside Server Components, Route Handlers, and Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // `setAll` can be invoked from a Server Component, where cookies
            // cannot be set. Safe to ignore when using the http-only cookie
            // auth pattern — the session is refreshed via middleware instead.
          }
        },
      },
    },
  )
}
