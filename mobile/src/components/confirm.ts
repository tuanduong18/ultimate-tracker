import { Alert } from 'react-native';

/**
 * The phone's second step before anything that can't be taken back — deleting, renewing early,
 * throwing away what was typed. Android's own Material dialog (themed to the app by
 * plugins/with-android-theme.js), not a lookalike: it traps TalkBack's focus, answers the back
 * gesture as "keep", and every Android user has met it before.
 *
 * This settles the shared open question of how the phone confirms (ux-ui-shared,
 * open-questions #2) for irreversible actions: a dialog, because nothing it guards can be
 * undone on the server, so a snackbar's Undo would have nothing to undo. Following the shared
 * rules: the title names the object, the message names the cost, the buttons are labelled by
 * outcome ("Yes, delete" / "Keep", never OK / Cancel), and the confirming one sits apart from the
 * button that opened the dialog. Destructive dialogs mark their button as such; one that writes
 * money (renew now) stays in the default tone, since nothing is destroyed.
 */
export function confirm({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep',
  destructive = false,
  onConfirm,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  Alert.alert(
    title,
    message,
    [
      { text: cancelLabel, style: 'cancel' },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ],
    { cancelable: true }
  );
}
