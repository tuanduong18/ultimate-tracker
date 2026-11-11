import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionRow } from '@/components/action-row';
import { Card, RowDivider } from '@/components/card';
import { HeaderAction } from '@/components/header-action';
import type { IconName } from '@/components/icon';
import { Sheet } from '@/components/sheet';

interface Logger {
  label: string;
  blurb: string;
  icon: IconName;
  href: Href;
}

/**
 * Everything that can be logged, one row per module that can log — the web's LOGGERS, in its
 * words. Only live modules belong here: when Fitness ships, "Workout" is a new row, not a new
 * button in the top bar, so the bar keeps one shape however many modules arrive.
 */
export const LOGGERS: readonly Logger[] = [
  { label: 'Expense', blurb: 'Something you paid for', icon: 'receipt_long', href: '/expense' },
];

/**
 * Log, in the top app bar of every tab — the twin of the web header's Log menu: log anything
 * from anywhere, then pick what. Logging is the core loop of a tracker and happens in a hurry,
 * so it is one tap from every tab, not only from inside Finance.
 *
 * A word rather than a "+" icon: on a screen that lists budgets, "+" would read as "new
 * budget". It opens a bottom sheet of loggers rather than the expense form directly, as the web
 * does, so people learn "Log, then pick" once and it never changes when a second module can log
 * — the cost is one tap while the sheet has a single row. Each row opens its full-screen form.
 * Within Finance, the floating Add expense button stays the screen's own main action.
 */
export function LogButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <HeaderAction label="Log" accessibilityLabel="Log something" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Log">
        <Card>
          {LOGGERS.map((logger, index) => (
            <View key={logger.label}>
              {index > 0 && <RowDivider />}
              <ActionRow
                label={logger.label}
                blurb={logger.blurb}
                icon={logger.icon}
                onPress={() => {
                  setOpen(false);
                  router.push(logger.href);
                }}
              />
            </View>
          ))}
        </Card>
      </Sheet>
    </>
  );
}
