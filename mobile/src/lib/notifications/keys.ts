/**
 * The notifications' cache keys, alone in a file so a module that only reloads them (a finance
 * write) needn't load the notification queries, and the Supabase client with them.
 *
 * Every key starts with 'notifications', so a change reloads the inbox and the history at once:
 * snoozing moves a reminder from one to the other.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: ['notifications', 'inbox'] as const,
  history: ['notifications', 'history'] as const,
};
