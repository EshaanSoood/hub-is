import type { ReactNode } from 'react';
import { Stack } from './Stack';

export const PageHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <header className="mb-8 border-b border-border-muted pb-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <Stack gap="xs">
        <h1 className="heading-1 text-primary">{title}</h1>
        {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
      </Stack>
      {action ? <div>{action}</div> : null}
    </div>
  </header>
);
