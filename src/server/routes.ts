// @ts-expect-error hub-api.mjs is the runtime server module for these route contracts.
import { withPolicyGate } from '../../apps/hub-api/hub-api.mjs';

export const serverRouteContracts = {
  getSession: withPolicyGate('hub.view', async () => undefined),
  getHome: withPolicyGate('hub.view', async () => undefined),
  getTasks: withPolicyGate('hub.view', async () => undefined),
  createTask: withPolicyGate('hub.tasks.write', async () => undefined),
  listProjects: withPolicyGate('projects.view', async () => undefined),
  listNotifications: withPolicyGate('hub.view', async () => undefined),
  authorizeHubLive: withPolicyGate('hub.live', async () => undefined),
  markNotificationRead: withPolicyGate('hub.notifications.write', async () => undefined),
};
