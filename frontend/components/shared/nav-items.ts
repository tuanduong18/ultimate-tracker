/**
 * Where the navigation goes — plain data, deliberately not a client module.
 *
 * Server Components read this too (the dashboard lists the modules), and a
 * non-component export of a 'use client' file reaches the server only as an
 * opaque reference, not as the array itself.
 */

import {
  BarChart3,
  Dumbbell,
  Gamepad2,
  LayoutDashboard,
  Settings,
  Timer,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * A module that is not built yet. Its page and its dashboard card say what is
 * coming, taken from the release plan in docs/features, so nothing here
 * promises more than the specs do.
 */
export interface PlannedModule {
  status: 'soon';
  /** The release it is scheduled for, as the specs name it. */
  release: string;
  planned: readonly string[];
}

export interface ModuleEntry extends NavEntry {
  blurb: string;
}

/**
 * Every signed-in destination, in the order the navigation lists them.
 *
 * Fitness absorbed the former Steps and Wellness entries — see
 * docs/features/fitness.md. Gaming sits last on purpose: it is the most
 * interesting domain to build, so it is scheduled after the rest are done.
 */
export const MODULES = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    blurb: 'Everything at a glance',
    icon: LayoutDashboard,
    status: 'live',
  },
  {
    href: '/finance',
    label: 'Finance',
    blurb: 'Expenses, budgets and subscriptions',
    icon: Wallet,
    status: 'live',
  },
  {
    href: '/fitness',
    label: 'Fitness',
    blurb: 'Training, steps, sleep and habits',
    icon: Dumbbell,
    status: 'soon',
    release: 'v0.2',
    planned: [
      'Log training sessions, with personal records spotted for you',
      'Daily step counts',
      'Sleep, mood and habits, in v0.3',
    ],
  },
  {
    href: '/time',
    label: 'Time',
    blurb: 'Where the hours go, and what is coming',
    icon: Timer,
    status: 'soon',
    release: 'v0.2',
    planned: [
      'A focus timer, tagged by category',
      'Weekly time budgets for entertainment, with a warning at 80%',
      'Google Calendar sync, in v0.3',
    ],
  },
  {
    href: '/insights',
    label: 'Insights',
    blurb: 'How the domains connect',
    icon: BarChart3,
    status: 'soon',
    release: 'v0.3',
    planned: [
      'A weekly digest in plain language, with one thing to try',
      'Patterns across domains — spending, sleep, training, time',
    ],
  },
  {
    href: '/gaming',
    label: 'Gaming',
    blurb: 'Match history and performance',
    icon: Gamepad2,
    status: 'soon',
    release: 'the final release',
    planned: [
      'Match history and performance trends',
      'Whether you should have stopped three games ago',
    ],
  },
] as const satisfies readonly (ModuleEntry & ({ status: 'live' } | PlannedModule))[];

export type Module = (typeof MODULES)[number];

/** The module behind a route, for the pages that render from this list. */
export function moduleFor(href: string): Module {
  const found = MODULES.find((entry) => entry.href === href);
  if (!found) throw new Error(`No module at ${href}`);
  return found;
}

/** Preferences rather than places to log something — they live in the account menu. */
export const ACCOUNT_LINKS = [
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const satisfies readonly NavEntry[];

export function isActive(pathname: string, href: string): boolean {
  // Prefix match so /finance/budgets keeps the Finance item highlighted.
  return pathname === href || pathname.startsWith(`${href}/`);
}
