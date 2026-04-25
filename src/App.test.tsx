import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const mockSignIn = vi.fn<() => Promise<void>>();

const authzContextValue = {
  signedIn: false,
  authReady: true,
  authError: undefined as string | undefined,
  signIn: mockSignIn,
};

vi.mock('./context/AuthzContext', () => ({
  useAuthz: () => authzContextValue,
}));

const renderApp = () => render(
  <MemoryRouter initialEntries={['/projects']}>
    <App />
  </MemoryRouter>,
);

describe('App auth redirect handling', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    authzContextValue.signedIn = false;
    authzContextValue.authReady = true;
    authzContextValue.authError = undefined;
  });

  it('starts login for a clean unauthenticated session', async () => {
    mockSignIn.mockResolvedValue(undefined);

    renderApp();

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
  });

  it('stops automatic login when auth initialization reports an error', async () => {
    authzContextValue.authError = 'Authenticated with Keycloak but failed to load hub session from server.';

    renderApp();

    expect(screen.getByText('Unable to complete sign-in.')).toBeInTheDocument();
    expect(screen.getByText(authzContextValue.authError)).toBeInTheDocument();
    await Promise.resolve();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('allows the user to retry sign-in after an auth error', async () => {
    authzContextValue.authError = 'Authenticated with Keycloak but failed to load hub session from server.';
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderApp();
    await user.click(screen.getByRole('button', { name: 'Retry sign-in' }));

    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });
});
