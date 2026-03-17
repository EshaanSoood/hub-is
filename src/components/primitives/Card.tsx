import { cn } from '../../lib/cn';

type CardVariant = 'surface' | 'elevated';

const cardClasses: Record<CardVariant, string> = {
  surface: 'bg-surface',
  elevated: 'bg-elevated',
};

export const Card = ({
  children,
  variant = 'elevated',
  className,
  as: Component = 'section',
  ...props
}: React.HTMLAttributes<HTMLElement> & { variant?: CardVariant; as?: 'section' | 'article' | 'header' | 'div' }) => (
  <Component
    {...props}
    className={cn('rounded-panel border border-subtle p-4 shadow-soft', cardClasses[variant], className)}
  >
    {children}
  </Component>
);
