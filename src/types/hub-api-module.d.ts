declare module '../../apps/hub-api/hub-api.mjs' {
  import type { Capability, SessionSummary } from './domain';

  export interface PolicyGateContext {
    auth?: {
      user: {
        user_id: string;
      };
      token?: string;
      claims?: unknown;
      devAuthMode?: boolean;
      error?: never;
    };
    params?: Record<string, string>;
    pathname?: string;
    projectId?: string;
    request?: unknown;
    requestUrl?: URL;
    response?: unknown;
    sessionSummary?: SessionSummary;
  }

  export function withPolicyGate(
    requiredCapability: Capability,
    handler: (context: PolicyGateContext) => unknown | Promise<unknown>,
  ): (context: PolicyGateContext) => Promise<unknown>;

  export function withPolicyGate(
    requiredCapability: Capability,
    projectIdResolver: (context: PolicyGateContext) => string,
    handler: (context: PolicyGateContext) => unknown | Promise<unknown>,
  ): (context: PolicyGateContext) => Promise<unknown>;
}
