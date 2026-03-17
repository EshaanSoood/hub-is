import { Toaster as Sonner } from 'sonner';

export const Toaster = () => (
  <Sonner
    theme="dark"
    richColors
    closeButton
    visibleToasts={3}
    toastOptions={{
      duration: 4500,
      classNames: {
        toast:
          'rounded-panel border border-border-muted bg-elevated text-text shadow-soft',
        title: 'text-sm font-semibold text-text',
        description: 'text-xs text-text-secondary',
        error: 'border-danger bg-danger-subtle text-danger',
        warning: 'border-border-muted bg-warning-subtle text-text',
        success: 'border-border-muted bg-success-subtle text-text',
        info: 'border-border-muted bg-elevated text-text',
        actionButton:
          'rounded-control border border-subtle bg-accent px-2 py-1 text-xs font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        cancelButton:
          'rounded-control border border-subtle bg-surface px-2 py-1 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        closeButton:
          'rounded-control border border-subtle bg-surface text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      },
    }}
  />
);
