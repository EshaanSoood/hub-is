import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../ui/command';

export interface CommandPaletteItem {
  id: string;
  label: string;
  shortcut?: string;
  onSelect?: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
  heading?: string;
  searchPlaceholder?: string;
}

export const CommandPalette = ({
  open,
  onOpenChange,
  items,
  heading = 'Actions',
  searchPlaceholder = 'Type a command or search...',
}: CommandPaletteProps) => (
  <CommandDialog open={open} onOpenChange={onOpenChange}>
    <Command>
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>No matching actions.</CommandEmpty>
        <CommandGroup heading={heading}>
          {items.map((item) => (
            <CommandItem
              key={item.id}
              value={item.label}
              onSelect={() => {
                item.onSelect?.();
                onOpenChange(false);
              }}
            >
              <span>{item.label}</span>
              {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </CommandList>
    </Command>
  </CommandDialog>
);
