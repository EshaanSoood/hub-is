import type { ServiceRegistryItem, SessionRole } from '../types/domain';

export const serviceRegistry: ServiceRegistryItem[] = [
  {
    id: 'keycloak',
    label: 'Keycloak',
    description: 'Identity provider (admin surface)',
    appUrl: 'https://auth.eshaansood.org/admin/master/console/',
    healthUrl: 'https://auth.eshaansood.org',
    ownerOnlyExternalUi: true,
  },
  {
    id: 'n8n',
    label: 'n8n',
    description: 'Workflow automation engine',
    appUrl: 'https://automations.eshaansood.org',
    healthUrl: 'https://automations.eshaansood.org/healthz',
    ownerOnlyExternalUi: true,
    wakeWorkflowUrl: '/api/wake/n8n',
    sleepWorkflowUrl: '/api/sleep/n8n',
  },
  {
    id: 'postmark',
    label: 'Postmark',
    description: 'Transactional email provider',
    appUrl: 'https://account.postmarkapp.com',
    healthUrl: '/api/health/postmark',
  },
  {
    id: 'ntfy',
    label: 'ntfy',
    description: 'Infrastructure push alert channel',
    appUrl: 'https://ntfy.sh',
    healthUrl: '/api/health/ntfy',
  },
  {
    id: 'nextcloud',
    label: 'Nextcloud',
    description: 'File storage and sharing',
    appUrl: 'https://cloud.eshaansood.org',
    healthUrl: 'https://cloud.eshaansood.org/status.php',
    ownerOnlyExternalUi: true,
    wakeWorkflowUrl: '/api/wake/nextcloud',
    sleepWorkflowUrl: '/api/sleep/nextcloud',
  },
  {
    id: 'openproject',
    label: 'OpenProject',
    description: 'Project task system',
    appUrl: 'https://projects.eshaansood.org',
    healthUrl: 'https://projects.eshaansood.org/health_checks/default',
    ownerOnlyExternalUi: true,
    wakeWorkflowUrl: '/api/wake/openproject',
    sleepWorkflowUrl: '/api/sleep/openproject',
  },
  {
    id: 'invoiceNinja',
    label: 'Invoice Ninja',
    description: 'Invoice generation and delivery',
    appUrl: 'https://invoices.eshaansood.org',
    healthUrl: 'https://invoices.eshaansood.org',
    sleepWorkflowUrl: '/api/sleep/invoiceNinja',
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Code visibility and pull requests',
    appUrl: 'https://github.com',
    healthUrl: 'https://www.githubstatus.com',
  },
];

export const canAccessServiceExternalUi = (
  sessionRole: SessionRole,
  service: ServiceRegistryItem,
): boolean => !service.ownerOnlyExternalUi || sessionRole === 'Owner';
