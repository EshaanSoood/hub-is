import type { ReactNode } from 'react';
import { Cluster } from './Cluster';
import { Stack } from './Stack';

export const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <Cluster className="justify-between" gap="sm">
    <Stack gap="xs">
      <h2 className="heading-2 text-primary">{title}</h2>
      {description ? <p className="text-muted">{description}</p> : null}
    </Stack>
    {action ? <div>{action}</div> : null}
  </Cluster>
);
