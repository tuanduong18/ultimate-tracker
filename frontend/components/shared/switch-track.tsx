/**
 * The drawn part of a switch: a track whose knob moves, so on and off differ by position and
 * shape as well as colour. Decorative — the `role="switch"` button around it carries the state
 * and the name — and shared so every switch in the app looks like one (the account menu's Dark
 * mode, the notification switches in Settings).
 */
export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-9 shrink-0 items-center rounded-full border-2 transition-colors motion-reduce:transition-none ${
        on ? 'border-primary bg-primary' : 'border-border-control bg-surface-muted'
      }`}
    >
      <span
        className={`size-3.5 rounded-full transition-transform motion-reduce:transition-none ${
          on ? 'translate-x-4 bg-primary-fg' : 'translate-x-0.5 bg-fg-muted'
        }`}
      />
    </span>
  );
}
