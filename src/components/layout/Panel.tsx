import type { ReactNode } from 'react';
import { Stack } from './Stack';

export const Panel = ({
  title,
  description,
  children,
  headingLevel = 2,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  headingLevel?: 2 | 3;
}) => {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section className="rounded-panel border border-border-muted bg-surface-elevated p-5 shadow-soft">
      <Stack gap="md">
        <header>
          <Heading className="heading-3 text-primary">{title}</Heading>
          {description ? <p className="mt-2 text-muted">{description}</p> : null}
        </header>
        <div>{children}</div>
      </Stack>
    </section>
  );
};
