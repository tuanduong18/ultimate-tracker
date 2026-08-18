'use client';

import { useEffect, useState } from 'react';

import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export interface SessionState {
  session: Session | null;
  /** True until Supabase has restored — or ruled out — a stored session. */
  loading: boolean;
}

/**
 * Subscribe to the Supabase auth session.
 *
 * `loading` matters: on first paint Supabase has not yet read its stored
 * session, and treating that moment as "signed out" would bounce a signed-in
 * user to the login page on every refresh.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
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

  return state;
}
