import { Stack } from 'expo-router';

import { ModulePlaceholder } from '@/components/module-placeholder';
import { moduleFor } from '@/navigation/modules';

/**
 * A module's screen while the app does not have the module yet: its name in the header and the
 * placeholder below. Each route file is one line on top of this, so a module that ships
 * replaces its own file and nothing else.
 */
export function ModuleScreen({ moduleKey }: { moduleKey: string }) {
  const entry = moduleFor(moduleKey);
  // A module the app has (Finance) owns its route files outright; reaching here is a wiring bug.
  if (entry.status === 'app') throw new Error(`${entry.label} has its own screens`);
  return (
    <>
      <Stack.Screen options={{ title: entry.label }} />
      <ModulePlaceholder module={entry} />
    </>
  );
}
