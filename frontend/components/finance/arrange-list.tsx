'use client';

import clsx from 'clsx';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { IconButton, PanelButton } from '@/components/finance/panel';

/** How near a scroll area's edge, in px, a dragged row starts scrolling it. */
const SCROLL_EDGE = 48;
/** How fast it scrolls with the pointer at the very edge, in px per frame. */
const SCROLL_SPEED = 14;

/** A drag in progress, measured once as it starts. */
interface Drag {
  from: number;
  /** Where the row would land if it were dropped now. */
  to: number;
  startY: number;
  y: number;
  scroller: HTMLElement;
  startScroll: number;
  rows: HTMLElement[];
  /** Each row's top and height in viewport px, as they were when the drag began. */
  tops: number[];
  heights: number[];
  /** How far a row slides to make room: the dragged row's height plus one gap. */
  step: number;
  frame: number;
  /** Stop the frame loop and drop the window listeners. */
  release: () => void;
}

/** The nearest ancestor that scrolls: the panel body on the dashboard, else the page. */
function scrollerOf(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * The stretch of the scroller a pointer can actually see, top and bottom in
 * viewport px. For the page that leaves out the sticky header and, on phones,
 * the tab bar: the insets `scroll-padding` already gives focus, read from there.
 */
function visibleBand(scroller: HTMLElement): [number, number] {
  if (scroller === document.scrollingElement || scroller === document.documentElement) {
    const style = getComputedStyle(document.documentElement);
    return [
      parseFloat(style.scrollPaddingTop) || 0,
      window.innerHeight - (parseFloat(style.scrollPaddingBottom) || 0),
    ];
  }
  const rect = scroller.getBoundingClientRect();
  return [Math.max(rect.top, 0), Math.min(rect.bottom, window.innerHeight)];
}

/** Scroll while the pointer is near an edge, faster the nearer it gets. */
function autoscroll(drag: Drag) {
  const [top, bottom] = visibleBand(drag.scroller);
  const past =
    drag.y < top + SCROLL_EDGE
      ? drag.y - (top + SCROLL_EDGE)
      : drag.y > bottom - SCROLL_EDGE
        ? drag.y - (bottom - SCROLL_EDGE)
        : 0;
  if (past !== 0) {
    drag.scroller.scrollTop += Math.max(-1, Math.min(1, past / SCROLL_EDGE)) * SCROLL_SPEED;
  }
}

/**
 * Put the dragged row under the pointer and slide the rows it has passed out
 * of its way, by transform alone.
 *
 * The list's real order changes only on drop. Reordering the DOM mid-drag would
 * move the row holding the pointer capture, and a moved element loses it.
 * Measuring once and translating also keeps every frame free of layout reads.
 */
function place(drag: Drag) {
  const { from, tops, heights, rows, step } = drag;
  const last = tops.length - 1;
  const scrolled = drag.scroller.scrollTop - drag.startScroll;
  // Held inside the list: dropped past either end, a row lands at that end.
  const offset = Math.min(
    Math.max(drag.y - drag.startY + scrolled, tops[0] - tops[from]),
    tops[last] + heights[last] - (tops[from] + heights[from])
  );
  const top = tops[from] + offset;
  const bottom = top + heights[from];
  // A row is passed once the dragged row's leading edge crosses its middle.
  // The edge rather than the dragged row's own middle: with rows of equal
  // height, held at the end of the list, the middles tie and the last place
  // could never be reached.
  drag.to = tops.filter((rowTop, i) => {
    const rowMiddle = rowTop + heights[i] / 2;
    return i < from ? top > rowMiddle : i > from && bottom > rowMiddle;
  }).length;

  rows.forEach((row, i) => {
    let shift = 0;
    if (i === from) shift = offset;
    else if (from < i && i <= drag.to) shift = -step;
    else if (drag.to <= i && i < from) shift = step;
    row.style.transform = shift === 0 ? '' : `translateY(${shift}px)`;
  });
}

interface ArrangeListProps<T extends { id: string }> {
  items: readonly T[];
  /** What a row is called in its buttons' names and in what is announced. */
  nameOf: (item: T) => string;
  /** The row's own surface — a budget's tint, a category's edge. */
  rowClassName?: (item: T) => string | undefined;
  /** What identifies the row, between the handle and the arrows. */
  children: (item: T) => ReactNode;
  onMove: (from: number, to: number) => void;
  /** While the order is being saved. */
  disabled?: boolean;
}

/**
 * A panel's list while it is being arranged: compact rows, each with a drag
 * handle and a pair of arrow buttons.
 *
 * Compact because arranging is about order, not contents. A budget card is
 * three times the height of its name, and a drag across tall cards in a
 * fixed-height panel is mostly scrolling. Each row keeps what tells it apart
 * at a glance — the budget's tint, the category's edge — so the list still
 * looks like the one being arranged.
 *
 * A mode rather than handles on every card: arranging is rare, and the cards
 * already carry their edit and delete buttons. Handles there would add
 * clutter to every visit, and on a phone, rows that start a drag get in the
 * way of scrolling past them.
 *
 * Dragging is by the handle only, so the rest of a row still scrolls the page
 * on touch. The arrows are the way for keyboards, screen readers (the handle
 * is hidden from them) and anyone who would rather not drag; WCAG 2.5.7 asks
 * for a single-tap alternative to any drag. A drag scrolls the panel, or the
 * page, when held near its edge, and Escape puts the row back.
 */
export function ArrangeList<T extends { id: string }>({
  items,
  nameOf,
  rowClassName,
  children,
  onMove,
  disabled,
}: ArrangeListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<Drag | null>(null);
  // Rows a drop left translated, to clear in the same frame the new order lands.
  const settlingRef = useRef<HTMLElement[] | null>(null);
  // The arrow to put focus back on: moving a row moves its DOM node, and a
  // moved element loses focus.
  const refocusRef = useRef<{ id: string; down: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useLayoutEffect(() => {
    // Before paint, and after the class that animates the sliding rows has
    // gone, so they land without sliding back from where they were drawn.
    settlingRef.current?.forEach((row) => {
      row.style.transform = '';
    });
    settlingRef.current = null;

    const target = refocusRef.current;
    const list = listRef.current;
    if (!target || !list) return;
    refocusRef.current = null;
    const row = [...list.children].find(
      (child) => child instanceof HTMLElement && child.dataset.arrangeId === target.id
    );
    const [up, down] = [...(row?.querySelectorAll('button') ?? [])];
    const wanted = target.down ? down : up;
    // At either end the arrow just used turns off; its partner is the way back.
    (wanted?.disabled ? (target.down ? up : down) : wanted)?.focus();
  });

  // Saving from the header can unmount the list mid-drag.
  useEffect(() => () => dragRef.current?.release(), []);

  function announce(item: T, to: number) {
    setAnnouncement(`${nameOf(item)} moved to ${to + 1} of ${items.length}.`);
  }

  function nudge(index: number, by: -1 | 1) {
    refocusRef.current = { id: items[index].id, down: by === 1 };
    onMove(index, index + by);
    announce(items[index], index + by);
  }

  function endDrag(drop: boolean) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    drag.release();
    if (drop) place(drag);
    settlingRef.current = drag.rows;
    if (drop && drag.to !== drag.from) {
      onMove(drag.from, drag.to);
      announce(items[drag.from], drag.to);
    }
    setDraggingId(null);
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, index: number) {
    const list = listRef.current;
    if (disabled || dragRef.current || !list) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // No text selection, and no focus moving to the handle.
    event.preventDefault();
    const { pointerId } = event;
    try {
      // Keeps a mouse drag alive outside the window. Touch is captured anyway.
      event.currentTarget.setPointerCapture?.(pointerId);
    } catch {
      // Only throws for a pointer that is no longer down; the drag ends at once.
    }

    const rows = [...list.children].filter((child) => child instanceof HTMLElement);
    const rects = rows.map((row) => row.getBoundingClientRect());
    const scroller = scrollerOf(list);
    const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0;

    const follow = (e: PointerEvent) => {
      if (e.pointerId === pointerId) drag.y = e.clientY;
    };
    const drop = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      drag.y = e.clientY;
      endDrag(true);
    };
    const abandon = (e: PointerEvent) => {
      if (e.pointerId === pointerId) endDrag(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endDrag(false);
    };
    const tick = () => {
      autoscroll(drag);
      place(drag);
      drag.frame = requestAnimationFrame(tick);
    };

    const drag: Drag = {
      from: index,
      to: index,
      startY: event.clientY,
      y: event.clientY,
      scroller,
      startScroll: scroller.scrollTop,
      rows,
      tops: rects.map((rect) => rect.top),
      heights: rects.map((rect) => rect.height),
      step: rects[index].height + gap,
      frame: requestAnimationFrame(tick),
      release() {
        cancelAnimationFrame(drag.frame);
        window.removeEventListener('pointermove', follow);
        window.removeEventListener('pointerup', drop);
        window.removeEventListener('pointercancel', abandon);
        window.removeEventListener('keydown', escape);
      },
    };
    window.addEventListener('pointermove', follow);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', abandon);
    window.addEventListener('keydown', escape);
    dragRef.current = drag;
    setDraggingId(items[index].id);
  }

  return (
    <>
      <p className="px-4 pt-3 text-xs text-fg-muted">
        Drag the handles or use the arrows, then Save order — it’s kept on all your devices.
      </p>
      {/* Mounted with the list, so it is in place before the first move fills it. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ul ref={listRef} className={clsx('space-y-2 p-3', draggingId && 'select-none')}>
        {items.map((item, index) => {
          const name = nameOf(item);
          const lifted = draggingId === item.id;
          return (
            <li
              key={item.id}
              data-arrange-id={item.id}
              className={clsx(
                'flex items-center gap-1 rounded-lg py-1 pr-1 pl-1',
                rowClassName?.(item),
                lifted
                  ? 'relative z-10 shadow-lg ring-2 ring-primary'
                  : draggingId &&
                      'transition-transform duration-150 ease-in-out motion-reduce:transition-none'
              )}
            >
              {/* Hidden from screen readers, which cannot drag: the arrows do
                  the same job and are announced. */}
              <span
                aria-hidden
                title="Drag to move"
                onPointerDown={(event) => startDrag(event, index)}
                className={clsx(
                  'flex size-8 shrink-0 touch-none items-center justify-center rounded-lg text-fg-muted pointer-coarse:size-11',
                  disabled ? 'opacity-50' : lifted ? 'cursor-grabbing' : 'cursor-grab hover:text-fg'
                )}
              >
                <GripVertical className="size-4" />
              </span>
              <div className="min-w-0 flex-1">{children(item)}</div>
              <IconButton
                label={`Move ${name} up`}
                icon={ChevronUp}
                disabled={disabled || index === 0}
                onClick={() => nudge(index, -1)}
              />
              <IconButton
                label={`Move ${name} down`}
                icon={ChevronDown}
                disabled={disabled || index === items.length - 1}
                onClick={() => nudge(index, 1)}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * The panel header's buttons for arranging.
 *
 * "Arrange" turns into "Save order" in place: the same button, so keyboard
 * focus stays on it, and the way out of the mode is where the way in was. The
 * panel's own actions (New) give way to Cancel meanwhile — adding a row in the
 * middle of arranging the others would leave the draft not knowing where it
 * goes. Both come back once the order is saved or dropped.
 *
 * Hidden while there is nothing to arrange — one row has only one order — and
 * while one of the panel's forms is open, so starting cannot throw away
 * half-typed input.
 */
export function ArrangeActions({
  arranging,
  canArrange,
  busy,
  noun,
  onStart,
  onCancel,
  onSave,
  children,
}: {
  arranging: boolean;
  canArrange: boolean;
  busy: boolean;
  /** What the rows are, plural — "budgets". */
  noun: string;
  onStart: () => void;
  onCancel: () => void;
  onSave: () => void;
  /** The panel's usual actions, shown when not arranging. */
  children: ReactNode;
}) {
  const arrangeRef = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState(false);
  const wasArrangingRef = useRef(arranging);

  // A save clicked in Safari, which does not focus a clicked button, leaves
  // focus on an arrow in the list — and the list goes when arranging ends.
  // Only when focus has fallen to the page: Save is usually already focused.
  useEffect(() => {
    const ended = wasArrangingRef.current && !arranging;
    wasArrangingRef.current = arranging;
    if (ended && (document.activeElement === null || document.activeElement === document.body)) {
      arrangeRef.current?.focus();
    }
  }, [arranging]);

  // Said once, as the mode starts and as it ends in a save; the visible list
  // changing shape says both to everyone else.
  const status = arranging
    ? `Arranging ${noun}. Use each row's Move up and Move down buttons, then Save order.`
    : saved
      ? 'Order saved.'
      : '';

  return (
    <>
      {arranging ? (
        <PanelButton
          label="Cancel arranging"
          onClick={() => {
            // Cancel is about to go; the button beside it stays.
            arrangeRef.current?.focus();
            setSaved(false);
            onCancel();
          }}
        >
          Cancel
        </PanelButton>
      ) : (
        children
      )}
      {(arranging || canArrange) && (
        <PanelButton
          ref={arrangeRef}
          label={arranging ? undefined : `Arrange ${noun}`}
          primary={arranging}
          onClick={() => {
            if (!arranging) {
              setSaved(false);
              onStart();
            } else if (!busy) {
              setSaved(true);
              onSave();
            }
          }}
        >
          {!arranging ? 'Arrange' : busy ? 'Saving…' : 'Save order'}
        </PanelButton>
      )}
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  );
}
