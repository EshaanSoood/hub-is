import { useEffect, useRef } from 'react';
import { Panel } from '../components/layout/Panel';
import { Stack } from '../components/layout/Stack';
import { useAuthz } from '../context/AuthzContext';
import { focusWhenReady } from '../lib/focusWhenReady';

export const LoginPage = () => {
  const { signIn, keycloakConfigured, authError } = useAuthz();
  const signInButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => focusWhenReady(() => signInButtonRef.current), []);

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Stack gap="lg" className="mb-6 text-center">
          <h1 className="heading-1 text-primary">Hub OS</h1>
        </Stack>

        <Panel title="Sign In" headingLevel={2}>
          <Stack gap="md">
            {authError ? (
              <p className="rounded-panel bg-danger-subtle px-3 py-2 text-sm text-danger">{authError}</p>
            ) : null}

            <button
              ref={signInButtonRef}
              type="button"
              disabled={!keycloakConfigured}
              onClick={() => {
                void signIn();
              }}
              className="w-full rounded-panel bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:bg-muted"
            >
              Continue with Keycloak
            </button>
          </Stack>
        </Panel>
      </div>
    </div>
  );
};
