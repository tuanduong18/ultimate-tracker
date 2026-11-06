import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import LogIn from '@/app/(auth)/login';

import { Themed } from '../../support/themed';

const mockSignInWithPassword = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (credentials: unknown) => mockSignInWithPassword(credentials),
    },
  },
}));

const mockSignInWithGoogle = jest.fn();
jest.mock('@/auth/google', () => ({ signInWithGoogle: () => mockSignInWithGoogle() }));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  Link: ({ children }: { children: ReactNode }) => children,
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  mockSignInWithPassword.mockReset();
  mockSignInWithGoogle.mockReset();
});

describe('Log in', () => {
  it('asks for both fields on an empty submit and sends nothing', async () => {
    await render(<LogIn />, { wrapper: Themed });
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your email address')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password')).toBeOnTheScreen();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('clears a field’s message as soon as it is fixed', async () => {
    await render(<LogIn />, { wrapper: Themed });
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');

    expect(screen.queryByText('Enter your email address')).toBeNull();
    expect(screen.getByText('Enter your password')).toBeOnTheScreen();
  });

  it('signs in with the trimmed address and shows a refusal in plain words', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    await render(<LogIn />, { wrapper: Themed });
    await fireEvent.changeText(screen.getByLabelText('Email'), '  me@example.com ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'correct horse');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'correct horse',
    });
    expect(
      await screen.findByText(
        'That email and password don’t match an account. Check both and try again.'
      )
    ).toBeOnTheScreen();
  });

  it('shows a Google failure, and nothing when Google was cancelled', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce({});
    await render(<LogIn />, { wrapper: Themed });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(screen.queryByRole('alert')).toBeNull();

    mockSignInWithGoogle.mockResolvedValueOnce({ error: 'The sign-in didn’t finish. Try again.' });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByText('The sign-in didn’t finish. Try again.')).toBeOnTheScreen();
  });

  it('lets the password be shown, as a toggle TalkBack can read', async () => {
    await render(<LogIn />, { wrapper: Themed });
    const toggle = screen.getByRole('togglebutton', { name: 'Show password' });
    // RNTL's toBeChecked() only knows checkbox, radio and switch; read the state TalkBack gets.
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(toggle);
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
  });
});
