import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

/**
 * "Version X is available": a new APK, found on the repository's GitHub Releases. Over-the-air
 * updates reach the installed app on their own; an APK is needed only when native code changes,
 * and nothing else would tell anyone it exists. docs/features/platform.md § Android app,
 * "Distribution".
 *
 * - At launch, **at most once a day**, from GitHub's API with no token (60 requests an hour per
 *   address, far above this). The repository is public, so neither the call nor the download
 *   needs an account.
 * - Only releases tagged `android-v<major>.<minor>.<patch>`, never a draft or a pre-release: a
 *   release starts as a draft while its APK is tried, so nobody is pointed at an untried one.
 * - Silent on every failure (offline, rate-limited, no releases yet): this is a convenience, and
 *   an error about it would be noise.
 *
 * GitHub, not the backend, so this file calls fetch() itself: the API client is for our API.
 */
const RELEASES_URL =
  'https://api.github.com/repos/tuanduong18/ultimate-tracker/releases?per_page=30';
const CHECK_KEY = 'ultimate-tracker.release-check';
const DAY_MS = 24 * 60 * 60 * 1000;
const TAG = /^android-v(\d+)\.(\d+)\.(\d+)$/;

export interface Release {
  version: string;
  url: string;
}

/** The fields this reads from GitHub's release objects. */
export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

function parts(version: string): number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

/** Positive when `a` is the later version. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a);
  const right = parts(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The newest published APK release, whatever this app's own version. */
export function newestRelease(releases: readonly GitHubRelease[]): Release | null {
  let newest: Release | null = null;
  for (const release of releases) {
    const match = TAG.exec(release.tag_name);
    if (!match || release.draft || release.prerelease) continue;
    const version = match.slice(1).join('.');
    if (!newest || compareVersions(version, newest.version) > 0) {
      newest = { version, url: release.html_url };
    }
  }
  return newest;
}

/** The release to offer: one newer than what is running, or none. */
export function laterThan(release: Release | null, current: string): Release | null {
  return release && compareVersions(release.version, current) > 0 ? release : null;
}

interface StoredCheck {
  /** ISO date-time. */
  checkedAt: string;
  newest: Release | null;
}

async function readCheck(): Promise<StoredCheck | null> {
  try {
    const raw = await SecureStore.getItemAsync(CHECK_KEY);
    return raw === null ? null : (JSON.parse(raw) as StoredCheck);
  } catch {
    return null;
  }
}

/** The newest release, from GitHub at most once a day, otherwise from the last answer. */
export async function findNewestRelease(now: Date = new Date()): Promise<Release | null> {
  const stored = await readCheck();
  if (stored && now.getTime() - Date.parse(stored.checkedAt) < DAY_MS) return stored.newest;
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return stored?.newest ?? null;
    const newest = newestRelease((await response.json()) as GitHubRelease[]);
    await SecureStore.setItemAsync(
      CHECK_KEY,
      JSON.stringify({ checkedAt: now.toISOString(), newest } satisfies StoredCheck)
    ).catch(() => undefined);
    return newest;
  } catch {
    return stored?.newest ?? null;
  }
}

/** For the foot of More: the release to offer, once the check has answered. */
export function useNewerRelease(): Release | null {
  const [release, setRelease] = useState<Release | null>(null);
  useEffect(() => {
    let active = true;
    const current = Constants.expoConfig?.version ?? '0.0.0';
    void findNewestRelease().then((newest) => {
      if (active) setRelease(laterThan(newest, current));
    });
    return () => {
      active = false;
    };
  }, []);
  return release;
}
