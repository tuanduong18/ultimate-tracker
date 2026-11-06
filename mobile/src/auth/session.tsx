import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

interface SessionState {
  session: Session | null;
  /** True until the stored session has been read — the splash screen waits for it. */
  loading: boolean;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Who is signed in, for the whole app: read once from secure storage on launch, then kept
 * current by Supabase's auth events (sign-in, refresh, sign-out — including the sign-out the
 * API client does on a 401).
 *
 * `loading` exists so the root layout can hold the splash screen until the answer is known;
 * otherwise a signed-in user would see the log-in screen flash before their tabs.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, loading: false });
      })
      .catch(() => {
        // Unreadable storage is treated as signed out: the log-in screen, not a dead splash.
        if (active) setState({ session: null, loading: false });
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (!state) throw new Error('useSession must be used inside SessionProvider');
  return state;
}
