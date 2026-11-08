import { Alert } from 'react-native';

import { confirm } from '@/components/confirm';

describe('confirm', () => {
  it('asks in Android’s dialog, with buttons named by outcome and Keep as the way out', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onConfirm = jest.fn();

    confirm({
      title: 'Delete Food?',
      message: 'Its expenses become uncategorised.',
      confirmLabel: 'Yes, delete',
      destructive: true,
      onConfirm,
    });

    const [title, message, buttons, options] = alert.mock.calls[0];
    expect(title).toBe('Delete Food?');
    expect(message).toBe('Its expenses become uncategorised.');
    expect(buttons?.map((b) => [b.text, b.style])).toEqual([
      ['Keep', 'cancel'],
      ['Yes, delete', 'destructive'],
    ]);
    expect(options).toEqual({ cancelable: true });

    buttons?.[1].onPress?.();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('keeps an action that writes money in the default tone', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    confirm({
      title: 'Renew now?',
      confirmLabel: 'Yes, renew',
      cancelLabel: 'Not now',
      onConfirm: jest.fn(),
    });

    expect(alert.mock.calls.at(-1)?.[2]?.[1].style).toBe('default');
  });
});
