import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
import { RADIUS, SPACE, TOUCH_TARGET } from '@/theme/scale';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * A list put in the person's own order — the phone's twin of the web's ArrangeList: drag a row
 * by its handle, or move it a step with its Move up and Move down buttons. Both edit a draft the
 * screen saves in one request (Save order), as on the web.
 *
 * The drag runs on the UI thread (gesture-handler and Reanimated), so the row follows the finger
 * at the screen's frame rate, and the rows it passes slide aside. A light haptic tick marks
 * picking a row up and each place it passes, as Android's own lists do. The buttons are there for
 * anyone who can't drag — and for TalkBack, which can't use the handle at all, so the handle is
 * hidden from it; each move is announced ("Food moved to 2 of 6."), the web's words.
 *
 * Rows are one fixed height, because a drag needs to know where each slot is before anything is
 * measured: 64dp holds a one-line name even at Android's largest font size (200%, 44dp of text).
 * Motion follows "Remove animations", as Reanimated does by default.
 */
export function ArrangeList<T extends { id: string }>({
  items,
  nameOf,
  onMove,
  renderRow,
}: {
  /** The rows in their draft order. */
  items: readonly T[];
  nameOf: (item: T) => string;
  /** Move the row drawn at `from` to be drawn at `to`. */
  onMove: (from: number, to: number) => void;
  /** What a row shows between its handle and its buttons. */
  renderRow: (item: T) => ReactNode;
}) {
  const { colors } = useAppTheme();
  const rowHeight = ROW_HEIGHT;
  const count = items.length;
  const positions = useSharedValue<Record<string, number>>(indexOf(items));

  // A move from a button, or a reload, re-seats every row where the draft now says it is.
  useEffect(() => {
    positions.set(indexOf(items));
  }, [items, positions]);

  function move(from: number, to: number) {
    if (to < 0 || to >= count || from === to) return;
    onMove(from, to);
    AccessibilityInfo.announceForAccessibility(
      `${nameOf(items[from])} moved to ${to + 1} of ${count}.`
    );
  }

  function drop(id: string, to: number) {
    const from = items.findIndex((item) => item.id === id);
    if (from !== -1) move(from, to);
  }

  return (
    <View
      style={{
        height: rowHeight * count,
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {items.map((item, index) => (
        <DraggableRow
          key={item.id}
          id={item.id}
          index={index}
          count={count}
          rowHeight={rowHeight}
          positions={positions}
          onDrop={drop}
        >
          {renderRow(item)}
          <IconButton
            icon="arrow_upward"
            label={`Move ${nameOf(item)} up`}
            disabled={index === 0}
            onPress={() => move(index, index - 1)}
          />
          <IconButton
            icon="arrow_downward"
            label={`Move ${nameOf(item)} down`}
            disabled={index === count - 1}
            onPress={() => move(index, index + 1)}
          />
        </DraggableRow>
      ))}
    </View>
  );
}

/** Every row's height: the 64dp of a row that opens or moves something. */
export const ROW_HEIGHT = TOUCH_TARGET + SPACE.lg;

function indexOf(items: readonly { id: string }[]): Record<string, number> {
  return Object.fromEntries(items.map((item, index) => [item.id, index]));
}

/** `positions` with `id` moved to slot `to` and the rows between shuffled one along. */
function moveTo(positions: Record<string, number>, id: string, to: number) {
  'worklet';
  const from = positions[id];
  const next: Record<string, number> = {};
  for (const key of Object.keys(positions)) {
    const at = positions[key];
    if (key === id) next[key] = to;
    else if (from < to && at > from && at <= to) next[key] = at - 1;
    else if (from > to && at < from && at >= to) next[key] = at + 1;
    else next[key] = at;
  }
  return next;
}

function tick() {
  void Haptics.selectionAsync();
}

function DraggableRow({
  id,
  index,
  count,
  rowHeight,
  positions,
  onDrop,
  children,
}: {
  id: string;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<Record<string, number>>;
  onDrop: (id: string, to: number) => void;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const top = useSharedValue(index * rowHeight);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  const last = (count - 1) * rowHeight;

  // Every row but the one in hand slides to its slot as the draft changes under it.
  useAnimatedReaction(
    () => positions.get()[id],
    (slot, previous) => {
      if (slot !== undefined && slot !== previous && !dragging.get()) {
        top.set(withTiming(slot * rowHeight, { duration: 150 }));
      }
    }
  );

  const pan = usePanGesture({
    minDistance: 0,
    onActivate: () => {
      dragging.set(true);
      start.set(top.get());
      scheduleOnRN(tick);
    },
    onUpdate: (event) => {
      top.set(Math.min(Math.max(start.get() + event.translationY, 0), last));
      const slot = Math.min(Math.max(Math.round(top.get() / rowHeight), 0), count - 1);
      if (slot !== positions.get()[id]) {
        positions.set(moveTo(positions.get(), id, slot));
        scheduleOnRN(tick);
      }
    },
    onFinalize: () => {
      if (!dragging.get()) return;
      dragging.set(false);
      const slot = positions.get()[id];
      top.set(withTiming(slot * rowHeight, { duration: 150 }));
      scheduleOnRN(onDrop, id, slot);
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: top.get() }],
    zIndex: dragging.get() ? 1 : 0,
    elevation: dragging.get() ? 4 : 0,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          height: rowHeight,
          flexDirection: 'row',
          alignItems: 'center',
          paddingRight: SPACE.xs,
          backgroundColor: colors.surface,
          borderRadius: RADIUS.card,
        },
        style,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            width: TOUCH_TARGET,
            height: rowHeight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="drag_indicator" tone="fgMuted" />
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}
