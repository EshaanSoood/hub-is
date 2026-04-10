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
    className={className}
    fill="currentColor"
    focusable="false"
    height={height}
    role={ariaLabel ? 'img' : undefined}
    viewBox="0 0 2131 1338"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(30.0,680) scale(1,-1)">
      <path d="M153 362H565V287H153ZM560 650H640V0H560ZM80 650H160V0H80Z" />
    </g>
    <g transform="translate(770.0,680) scale(1,-1)">
      <path d="M535 250V650H615V250Q615 195 602.0 152.5Q589 110 565.5 79.0Q542 48 509.0 28.5Q476 9 435.5 -0.5Q395 -10 349 -10Q302 -10 261.0 -0.5Q220 9 186.5 28.5Q153 48 129.5 79.0Q106 110 93.0 152.5Q80 195 80 250V650H160V250Q160 175 186.0 135.0Q212 95 255.0 80.0Q298 65 349 65Q399 65 441.0 80.0Q483 95 509.0 135.0Q535 175 535 250Z" />
    </g>
    <g transform="translate(1485.0,680) scale(1,-1)">
      <path d="M80 0V650H336Q437 650 493.5 604.0Q550 558 550 476Q550 425 529.5 393.0Q509 361 472.0 345.0Q435 329 385 324L387 330Q424 328 457.0 320.5Q490 313 515.5 297.0Q541 281 556.0 253.0Q571 225 571 181Q571 122 545.0 83.0Q519 44 472.5 23.5Q426 3 366 0ZM160 75H346Q414 75 452.5 100.5Q491 126 491 181Q491 225 466.5 247.0Q442 269 404.0 276.5Q366 284 326 284H160ZM160 359H326Q394 359 432.5 388.5Q471 418 471 473Q471 527 432.5 551.0Q394 575 336 575H160Z" />
    </g>
    <path
      d="M 714.4 740 Q 899.8 695 1117.5 740 T 1520.6 740"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="42"
    />
    <g transform="translate(633.4,1297.5) scale(0.75,-0.75)">
      <path d="M370 -10Q281 -10 208.5 31.5Q136 73 93.0 148.0Q50 223 50 325Q50 427 93.0 502.5Q136 578 208.5 619.0Q281 660 370 660Q459 660 531.5 619.0Q604 578 647.0 502.5Q690 427 690 325Q690 223 647.0 148.0Q604 73 531.5 31.5Q459 -10 370 -10ZM370 65Q438 65 492.0 94.5Q546 124 578.0 182.0Q610 240 610 325Q610 410 578.0 467.5Q546 525 492.0 555.0Q438 585 370 585Q303 585 248.5 555.0Q194 525 162.0 467.5Q130 410 130 325Q130 240 162.0 182.0Q194 124 248.5 94.5Q303 65 370 65Z" />
    </g>
    <g transform="translate(1195.9,1297.5) scale(0.75,-0.75)">
      <path d="M36 211H108Q111 169 133.0 136.0Q155 103 193.5 84.0Q232 65 284 65Q329 65 359.5 78.5Q390 92 405.5 116.0Q421 140 421 172Q421 205 405.0 225.0Q389 245 359.0 259.0Q329 273 288 286Q249 298 209.0 314.0Q169 330 134.5 353.0Q100 376 79.0 408.5Q58 441 58 487Q58 532 82.5 571.5Q107 611 154.5 635.5Q202 660 269 660Q374 660 426.0 603.0Q478 546 476 452H404Q402 523 364.0 554.0Q326 585 265 585Q214 585 176.0 561.5Q138 538 138 488Q138 466 146.5 449.5Q155 433 174.5 419.0Q194 405 227.5 391.5Q261 378 310 362Q342 352 375.5 338.0Q409 324 437.5 303.0Q466 282 483.5 249.5Q501 217 501 168Q501 121 478.5 80.5Q456 40 408.5 15.0Q361 -10 286 -10Q222 -10 176.5 7.5Q131 25 102.0 53.0Q73 81 57.5 111.5Q42 142 37.0 169.0Q32 196 36 211Z" />
    </g>
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
