"use client";

import { useEffect, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import { api, ApiError } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  timezone: string;
  created_at: string;
}

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("");

  // Keep local state in sync with Supabase's auth session.
  useEffect(() => {
    const sync = () => {
      void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    };
    sync();
    const { data: listener } = supabase.auth.onAuthStateChange(() => sync());
    return () => listener.subscription.unsubscribe();
  }, []);

  // Once signed in, prove the round-trip: frontend -> backend -> database.
  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setStatus("Calling backend GET /api/v1/auth/me …");
    api
      .get<Profile>("/auth/me")
      .then((p) => {
        setProfile(p);
        setStatus("Round-trip OK ✓ (Supabase JWT → backend → Postgres → back)");
      })
      .catch((err: unknown) => {
        setProfile(null);
        setStatus(
          err instanceof ApiError
            ? `Backend error — ${err.code}: ${err.message}`
            : `Request failed: ${String(err)}`,
        );
      });
  }, [session]);

  async function handleSignUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    setStatus(
      error
        ? `Sign-up failed: ${error.message}`
        : "Signed up. If email confirmation is on, confirm then log in.",
    );
  }

  async function handleSignIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setStatus(`Sign-in failed: ${error.message}`);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setStatus("");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {session ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm">
            Signed in as <span className="font-mono">{session.user.email}</span>
          </p>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={handleSignOut}
          >
            Log out
          </button>
          {profile && (
            <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs">
              {JSON.stringify(profile, null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-500">
            Sign in to verify the chain: Supabase → backend → database.
          </p>
          <input
            className="w-full rounded border px-3 py-2"
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-black px-4 py-2 text-sm text-white"
              onClick={handleSignIn}
            >
              Log in
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm"
              onClick={handleSignUp}
            >
              Sign up
            </button>
          </div>
        </div>
      )}

      {status && <p className="mt-4 text-sm text-gray-600">{status}</p>}
    </main>
  );
}
