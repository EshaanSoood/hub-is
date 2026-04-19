import type { ComponentType } from 'react';
import {
  Alarm,
  ArrowLeft,
  BellSimple,
  BellSimpleRinging,
  Binoculars,
  CalendarBlank,
  CaretDown,
  Check,
  ClockCounterClockwise,
  Compass,
  Cube,
  DotsThree,
  Gear,
  House,
  Kanban,
  Lightbulb,
  ListChecks,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  PushPin,
  Table,
  Target,
  Trash,
  UploadSimple,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import type { IconProps as PhosphorIconProps, IconWeight } from '@phosphor-icons/react';

interface BaseIconProps {
  className?: string;
}

interface BrandIconProps extends BaseIconProps {
  width?: number | string;
  height?: number | string;
  'aria-label'?: string;
}

interface IconGraphicProps extends BaseIconProps {
  date?: Date | number | string;
  timeZone?: string;
  size?: number | string;
  weight?: IconWeight;
}

type IconComponent = ComponentType<IconGraphicProps>;

const createPhosphorIcon = (Component: ComponentType<PhosphorIconProps>): IconComponent =>
  ({ className, size, weight }: IconGraphicProps) => (
    <Component
      aria-hidden="true"
      className={className}
      size={size}
      weight={weight ?? 'regular'}
    />
  );

export const CheckmarkIcon = createPhosphorIcon(Check);
export const CloseIcon = createPhosphorIcon(X);
export const PlusIcon = createPhosphorIcon(Plus);
export const ChevronDownIcon = createPhosphorIcon(CaretDown);
export const TrashIcon = createPhosphorIcon(Trash);
export const ThoughtPileIcon = createPhosphorIcon(Lightbulb);
export const CalendarIcon = createPhosphorIcon(CalendarBlank);
export const UploadIcon = createPhosphorIcon(UploadSimple);
export const BellUnreadIcon = createPhosphorIcon(BellSimpleRinging);
export const BellReadIcon = createPhosphorIcon(BellSimple);
export const RemindersIcon = createPhosphorIcon(Alarm);
export const TasksIcon = createPhosphorIcon(ListChecks);
export const KanbanIcon = createPhosphorIcon(Kanban);
export const TableIcon = createPhosphorIcon(Table);
export const UserIcon = createPhosphorIcon(UserCircle);
export const NavIcon = createPhosphorIcon(Compass);
export const FilterIcon = createPhosphorIcon(Binoculars);
export const SearchIcon = createPhosphorIcon(MagnifyingGlass);
export const ProjectListIcon = createPhosphorIcon(Cube);
export const MoreIcon = createPhosphorIcon(DotsThree);
export const MenuIcon = NavIcon;
export const SettingsIcon = createPhosphorIcon(Gear);
export const BackIcon = createPhosphorIcon(ArrowLeft);
export const TimelineIcon = createPhosphorIcon(ClockCounterClockwise);
export const PinIcon = createPhosphorIcon(PushPin);
export const EditIcon = createPhosphorIcon(PencilSimple);
export const HomeIcon = createPhosphorIcon(House);
export const FocusIcon = createPhosphorIcon(Target);

export const HubOsWordmark = ({ className, width, height, 'aria-label': ariaLabel }: BrandIconProps) => (
  <svg
    aria-hidden={ariaLabel ? undefined : true}
    aria-label={ariaLabel}
    className={['facets-wordmark', className].filter(Boolean).join(' ')}
    fill="currentColor"
    focusable="false"
    height={height}
    role={ariaLabel ? 'img' : undefined}
    viewBox="0 0 296 52"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
  >
    <text x="0" y="38" className="facets-wordmark-text">
      Facets
    </text>
  </svg>
);

export const HubOsMark = ({ className, width, height, 'aria-label': ariaLabel }: BrandIconProps) => (
  <svg
    aria-hidden={ariaLabel ? undefined : true}
    aria-label={ariaLabel}
    className={className}
    fill="currentColor"
    focusable="false"
    height={height}
    role={ariaLabel ? 'img' : undefined}
    viewBox="693 30 849 754"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(770.0,680) scale(1,-1)">
      <path d="M535 250V650H615V250Q615 195 602.0 152.5Q589 110 565.5 79.0Q542 48 509.0 28.5Q476 9 435.5 -0.5Q395 -10 349 -10Q302 -10 261.0 -0.5Q220 9 186.5 28.5Q153 48 129.5 79.0Q106 110 93.0 152.5Q80 195 80 250V650H160V250Q160 175 186.0 135.0Q212 95 255.0 80.0Q298 65 349 65Q399 65 441.0 80.0Q483 95 509.0 135.0Q535 175 535 250Z" />
    </g>
    <path
      d="M 714.4 740 Q 899.8 695 1117.5 740 T 1520.6 740"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="42"
    />
  </svg>
);

export type IconName =
  | 'checkmark'
  | 'close'
  | 'plus'
  | 'chevron-down'
  | 'trash'
  | 'thought-pile'
  | 'calendar'
  | 'upload'
  | 'bell-unread'
  | 'bell-read'
  | 'reminders'
  | 'tasks'
  | 'kanban'
  | 'table'
  | 'user'
  | 'menu'
  | 'nav'
  | 'filter'
  | 'project-list'
  | 'more'
  | 'settings'
  | 'back'
  | 'timeline'
  | 'pin'
  | 'edit'
  | 'home'
  | 'focus'
  | 'search';

export const ICON_MAP: Record<IconName, IconComponent> = {
  checkmark: CheckmarkIcon,
  close: CloseIcon,
  plus: PlusIcon,
  'chevron-down': ChevronDownIcon,
  trash: TrashIcon,
  'thought-pile': ThoughtPileIcon,
  calendar: CalendarIcon,
  upload: UploadIcon,
  'bell-unread': BellUnreadIcon,
  'bell-read': BellReadIcon,
  reminders: RemindersIcon,
  tasks: TasksIcon,
  kanban: KanbanIcon,
  table: TableIcon,
  user: UserIcon,
  menu: MenuIcon,
  nav: NavIcon,
  filter: FilterIcon,
  'project-list': ProjectListIcon,
  more: MoreIcon,
  settings: SettingsIcon,
  back: BackIcon,
  timeline: TimelineIcon,
  pin: PinIcon,
  edit: EditIcon,
  home: HomeIcon,
  focus: FocusIcon,
  search: SearchIcon,
};

interface IconProps extends BaseIconProps {
  label?: string;
  name: IconName;
  date?: Date | number | string;
  timeZone?: string;
  size?: number | string;
  weight?: IconWeight;
}

export const Icon = ({
  className,
  date,
  label,
  name,
  size,
  timeZone,
  weight,
}: IconProps) => {
  const Component = ICON_MAP[name];

  if (label) {
    return (
      <span aria-label={label} role="img">
        <Component className={className} date={date} size={size} timeZone={timeZone} weight={weight} />
      </span>
    );
  }

  return <Component className={className} date={date} size={size} timeZone={timeZone} weight={weight} />;
};
