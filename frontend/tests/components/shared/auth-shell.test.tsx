import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthShell, Field } from '@/components/shared/auth-shell';

describe('Field', () => {
  it('lets a password be shown and hidden again', () => {
    render(<Field id="password" label="Password" type="password" defaultValue="hunter22" />);
    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('ties a hint to its input for screen readers', () => {
    render(<Field id="new" label="Password" type="password" hint="At least 8 characters." />);

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 8 characters.');
  });

  it('offers no toggle on a field that is not a password', () => {
    render(<Field id="email" label="Email" type="email" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('AuthShell', () => {
  it('puts the page title in the one h1', () => {
    render(
      <AuthShell title="Welcome back">
        <p>form</p>
      </AuthShell>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });
});
