import { cn } from '../../lib/cn';
import { Checkbox as CheckboxRoot } from '../ui/checkbox';

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

export const Checkbox = ({ checked, onCheckedChange, className, ...props }: CheckboxProps) => (
  <CheckboxRoot
    checked={checked}
    onCheckedChange={(next) => onCheckedChange(next === true)}
    className={className}
    {...props}
  />
);

export interface CheckboxFieldProps extends CheckboxProps {
  label: string;
  description?: string;
  labelClassName?: string;
}

export const CheckboxField = ({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  labelClassName,
  className,
}: CheckboxFieldProps) => (
  <label htmlFor={id} className={cn('flex items-start gap-2 text-sm text-text', labelClassName)}>
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={className}
      aria-label={label}
    />
    <span>
      <span>{label}</span>
      {description ? <span className="block text-xs text-muted">{description}</span> : null}
    </span>
  </label>
);

export interface CheckboxGroupProps {
  legend: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export const CheckboxGroup = ({ legend, description, className, children }: CheckboxGroupProps) => (
  <fieldset className={cn('rounded-panel border border-subtle bg-surface p-3', className)}>
    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{legend}</legend>
    {description ? <p className="text-xs text-muted">{description}</p> : null}
    <div className="mt-2 space-y-2">{children}</div>
  </fieldset>
);
