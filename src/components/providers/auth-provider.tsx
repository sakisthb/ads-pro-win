'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { api } from '@/components/providers/trpc-provider'

interface AuthContextValue {
  /** The current Supabase user, or null when signed out. */
  user: User | null
  /** True until the initial session lookup settles. */
  isLoading: boolean
  /** Signs the user out and clears the http-only session cookies. */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signOut: async () => {},
})

/**
 * Read the current Supabase user on mount and keep it in sync with any auth
 * state change (login, signup, sign-out, token refresh). This mirrors the
 * http-only cookie session established by the server middleware/layout so
 * client components can reactively consume auth state.
 *
 * Right after a session resolves we run the `organizations.ensureMembership`
 * bootstrap (idempotent) so every authenticated user is assigned to the
 * shared "Demo" sample org (viewer) plus a personal org (owner) — the same
 * pattern real SaaS apps execute right after signup.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const utils = api.useUtils()
  const ensureMembership = api.organizations.ensureMembership.useMutation({
    onSuccess: async () => {
      // New memberships were (possibly) created — refresh any cached org
      // queries so the switcher and org-scoped data reflect them.
      await Promise.all([
        utils.organizations.list.invalidate(),
        utils.organizations.getCurrent.invalidate(),
      ])
    },
  })

  // Track the last user id we bootstrapped for so we only run the idempotent
  // mutation once per session (token refreshes re-emit SIGNED_IN).
  const ensuredRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Hydrate the initial session once on mount.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) {
        setUser(user)
        setIsLoading(false)
      }
    })

    // Keep client state in sync with cookie/session changes so every consumer
    // re-renders automatically after login, signup, or sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  // Run the membership bootstrap exactly once per authenticated user.
  useEffect(() => {
    if (!user) {
      ensuredRef.current = null
      return
    }
    if (ensuredRef.current === user.id) return
    ensuredRef.current = user.id
    ensureMembership.mutate()
    // ensureMembership is a stable tRPC mutation dispatcher; depending only
    // on `user` keeps this effect idempotent per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const signOut = useMemo(
    () => async () => {
      await supabase.auth.signOut()
    },
    [supabase],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, signOut }),
    [user, isLoading, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
