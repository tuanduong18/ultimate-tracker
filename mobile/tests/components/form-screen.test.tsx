import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { FormScreen, useLeaveGuard } from '@/components/form-screen';
import { Text } from '@/components/text';
import { Themed } from '../support/themed';

type Blocked = { repeat: () => void };
const mockPreventRemove = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: mockBack, canGoBack: () => true }),
  usePreventRemove: (prevent: boolean, callback: (blocked: Blocked) => void) =>
    mockPreventRemove(prevent, callback),
}));

beforeEach(() => {
  mockPreventRemove.mockReset();
  mockBack.mockReset();
});

describe('FormScreen', () => {
  it('saves from its pinned button, which says what it is doing while it runs', async () => {
    const onSubmit = jest.fn();
    const view = await render(
      <FormScreen title="Add expense" submitLabel="Add expense" busy={false} onSubmit={onSubmit}>
        <Text>Fields</Text>
      </FormScreen>,
      { wrapper: Themed }
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));
    expect(onSubmit).toHaveBeenCalled();

    await view.rerender(
      <FormScreen title="Add expense" submitLabel="Add expense" busy onSubmit={onSubmit}>
        <Text>Fields</Text>
      </FormScreen>
    );
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('shows why a save failed, next to the button', async () => {
    await render(
      <FormScreen
        title="Add expense"
        submitLabel="Add expense"
        busy={false}
        error="Could not save that expense."
        onSubmit={jest.fn()}
      >
        <Text>Fields</Text>
      </FormScreen>,
      { wrapper: Themed }
    );

    expect(screen.getByText('Could not save that expense.')).toBeOnTheScreen();
  });
});

describe('useLeaveGuard', () => {
  it('guards only while something is typed', async () => {
    const view = await renderHook((dirty: boolean) => useLeaveGuard(dirty), {
      initialProps: false,
    });
    expect(mockPreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function));

    await view.rerender(true);
    expect(mockPreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
  });

  it('asks before throwing typing away, and goes on only after Discard', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderHook(() => useLeaveGuard(true));
    const repeat = jest.fn();

    await act(async () => mockPreventRemove.mock.lastCall[1]({ repeat }));
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toBe('Discard changes?');
    expect(buttons?.map((b) => b.text)).toEqual(['Keep editing', 'Discard']);
    expect(repeat).not.toHaveBeenCalled();

    await act(async () => buttons?.[1].onPress?.());
    expect(repeat).toHaveBeenCalled();
    // The blocked gesture goes through by itself; nothing pops a second screen.
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('closes without asking once the save has landed', async () => {
    const view = await renderHook(() => useLeaveGuard(true));

    await act(async () => view.result.current());

    expect(mockPreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
