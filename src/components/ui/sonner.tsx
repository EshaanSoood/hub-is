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
          'rounded-control border border-subtle bg-accent px-2 py-1 text-xs font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-primary)] focus-visible:outline-offset-2',
        cancelButton:
          'rounded-control border border-secondary/30 bg-surface px-2 py-1 text-xs font-semibold text-secondary hover:border-secondary/45 hover:bg-secondary/10 hover:text-secondary-strong focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-primary)] focus-visible:outline-offset-2',
        closeButton:
          'rounded-control border border-secondary/30 bg-surface text-secondary hover:border-secondary/45 hover:bg-secondary/10 hover:text-secondary-strong focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-primary)] focus-visible:outline-offset-2',
      },
    }}
  />
);
