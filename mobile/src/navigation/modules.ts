import type { Href } from 'expo-router';

import type { IconName } from '@/components/icon';

/**
 * Every module, in the order the navigation lists them — the phone's copy of the web's
 * frontend/components/shared/nav-items.ts. Labels, blurbs and order match the web, so the two
 * clients read as one app; what each says about its own state is the phone's.
 *
 * `app`: built in the app, with its own screens. `soon`: built on neither client yet — its
 * release and plans come from the release plan in docs/features, so nothing here promises more
 * than the specs do. There is no "on the web only" state any more: the app reached the web's
 * features with the Dashboard, and from here a feature ships on both (ADR-0004).
 *
 * `href` is where the module opens: its tab, or its screen in More's stack.
 */
export const MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    blurb: 'Everything at a glance',
    icon: 'space_dashboard',
    href: '/dashboard',
    status: 'app',
  },
  {
    key: 'finance',
    label: 'Finance',
    blurb: 'Expenses, budgets and subscriptions',
    icon: 'account_balance_wallet',
    href: '/finance',
    status: 'app',
  },
  {
    key: 'fitness',
    label: 'Fitness',
    blurb: 'Training, steps, sleep and habits',
    icon: 'fitness_center',
    href: '/fitness',
    status: 'soon',
    release: 'v0.2',
    planned: [
      'Log training sessions, with personal records spotted for you',
      'Daily steps, counted by your phone',
      'Sleep, mood and habits, in v0.3',
    ],
  },
  {
    key: 'time',
    label: 'Time',
    blurb: 'Where the hours go, and what is coming',
    icon: 'timer',
    href: '/time',
    status: 'soon',
    release: 'v0.2',
    planned: [
      'A focus timer, tagged by category',
      'Screen time from your phone, counted toward weekly entertainment budgets',
      'Google Calendar sync, in v0.3',
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    blurb: 'How the domains connect',
    icon: 'insights',
    href: '/more/insights',
    status: 'soon',
    release: 'v0.3',
    planned: [
      'A weekly digest in plain language, with one thing to try',
      'Patterns across domains — spending, sleep, training, time',
    ],
  },
  {
    key: 'gaming',
    label: 'Gaming',
    blurb: 'Match history and performance',
    icon: 'sports_esports',
    href: '/more/gaming',
    status: 'soon',
    release: 'the final release',
    planned: [
      'Match history and performance trends',
      'Whether you should have stopped three games ago',
    ],
  },
] as const satisfies readonly ModuleEntry[];

interface ModuleBase {
  key: string;
  label: string;
  blurb: string;
  icon: IconName;
  href: Href;
}

export type ModuleEntry = ModuleBase &
  ({ status: 'app' } | { status: 'soon'; release: string; planned: readonly string[] });

/** A module the app doesn't have screens for yet: what a placeholder can show. */
export type PlaceholderEntry = Exclude<ModuleEntry, { status: 'app' }>;

export type Module = (typeof MODULES)[number];

// Destructured rather than sliced: a slice widens every entry to the union of all six, and then
// More's links (`/more/${key}`) fail typed routes for modules that have no screen there.
const [dashboard, finance, fitness, time, ...more] = MODULES;

/**
 * The modules that get a tab of their own, as on the web's phone layout; the rest sit behind
 * More. Four plus More is five destinations, the most a bottom bar holds before labels crowd.
 */
export const TABBED = [dashboard, finance, fitness, time];

export const MORE = more;

export function moduleFor(key: string): Module {
  const found = MODULES.find((entry) => entry.key === key);
  if (!found) throw new Error(`No module ${key}`);
  return found;
}
