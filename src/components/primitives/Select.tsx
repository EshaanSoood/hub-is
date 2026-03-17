import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
}

export const Select = ({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  ariaLabel,
  disabled,
  triggerClassName,
  contentClassName,
}: SelectProps) => (
  <SelectRoot value={value} onValueChange={onValueChange} disabled={disabled}>
    <SelectTrigger id={id} aria-label={ariaLabel} className={triggerClassName}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className={contentClassName}>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </SelectRoot>
);

export interface SelectFieldProps extends SelectProps {
  label: string;
  labelClassName?: string;
}

export const SelectField = ({ label, labelClassName, id, ...props }: SelectFieldProps) => (
  <label htmlFor={id} className={labelClassName}>
    <span>{label}</span>
    <Select id={id} {...props} />
  </label>
);
