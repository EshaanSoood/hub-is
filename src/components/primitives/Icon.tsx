import type { ComponentType, ReactNode } from 'react';
import { useId } from 'react';

interface BaseIconProps {
  className?: string;
}

interface IconGraphicProps extends BaseIconProps {
  date?: Date | number | string;
  timeZone?: string;
}

interface SvgIconProps extends BaseIconProps {
  children: ReactNode;
  viewBox: string;
}

const SvgIcon = ({ className, children, viewBox }: SvgIconProps) => (
  <svg
    aria-hidden="true"
    className={className}
    focusable="false"
    height="1em"
    viewBox={viewBox}
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

type IconComponent = ComponentType<IconGraphicProps>;

const formatCalendarDay = (value?: Date | number | string, timeZone?: string): string => {
  const source = value ?? new Date();
  const date = source instanceof Date ? source : new Date(source);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    timeZone,
  }).format(date);
};

export const CheckmarkIcon = ({ className }: IconGraphicProps) => (
  <SvgIcon className={className} viewBox="0 0 100 100">
    <path
      d="M 20 50 L 45 75 L 85 25"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </SvgIcon>
);

export const CloseIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="white" height="100" width="100" />
          <path d="M 30 30 L 70 70" stroke="black" strokeLinecap="round" strokeWidth="22" />
        </mask>
      </defs>
      <path d="M 30 70 L 70 30" stroke="currentColor" strokeLinecap="round" strokeWidth="18" />
      <path d="M 30 30 L 70 70" mask={`url(#${maskId})`} stroke="currentColor" strokeLinecap="round" strokeWidth="18" />
    </SvgIcon>
  );
};

export const PlusIcon = ({ className }: IconGraphicProps) => (
  <SvgIcon className={className} viewBox="0 0 100 100">
    <path
      d="M 50 25 V 75 M 25 50 H 75"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="18"
    />
  </SvgIcon>
);

export const ChevronDownIcon = ({ className }: IconGraphicProps) => (
  <SvgIcon className={className} viewBox="0 0 100 100">
    <path
      d="M 25 40 Q 50 70 75 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="16"
    />
  </SvgIcon>
);

export const TrashIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <path d="M 25 25 H 75 V 80 Q 75 90 65 90 H 35 Q 25 90 25 80 Z" fill="white" />
          <path d="M 35 55 Q 50 45 65 55" fill="none" stroke="black" strokeLinecap="round" strokeWidth="8" />
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const ThoughtPileIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <g fill="white">
            <path d="M 10 25 Q 10 20 15 20 L 85 20 Q 90 20 90 25 C 90 60 75 75 50 75 C 25 75 10 60 10 25 Z" />
            <path d="M 38 67 C 25 67 22 87 38 87 C 45 87 48 80 50 77 C 52 80 55 87 62 87 C 78 87 75 67 62 67 C 55 67 52 74 50 77 C 48 74 45 67 38 67 Z" />
          </g>
          <g fill="none" stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5">
            <path d="M 22 30 Q 30 40 45 32 T 65 38 T 78 30" />
            <path d="M 35 48 Q 45 40 55 52 T 75 46" />
            <path d="M 28 60 Q 38 52 48 64 T 68 58" />
          </g>
          <circle cx="38" cy="77" fill="black" r="6" />
          <circle cx="62" cy="77" fill="black" r="6" />
          <g fill="none" stroke="black" strokeLinecap="round" strokeWidth="2.5">
            <path d="M 42 71 Q 50 69 58 71" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const CalendarIcon = ({ className, date, timeZone }: IconGraphicProps) => {
  const maskId = useId();
  const dayLabel = formatCalendarDay(date, timeZone);

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <path d="M 25,10 a 5,5 0 0,0 -5,5 V 85 a 5,5 0 0,0 5,5 H 75 a 5,5 0 0,0 5,-5 V 40 L 50,10 Z" fill="white" />
          <g fill="black">
            <polygon points="50,10 80,40 65,25" />
            <circle cx="35" cy="22" r="6" />
            <rect height="48" width="49" x="25.5" y="36.5" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
      {dayLabel ? (
        <text
          dominantBaseline="middle"
          fill="currentColor"
          fontFamily="'DM Sans', ui-sans-serif, system-ui, sans-serif"
          fontSize="32"
          fontWeight="700"
          textAnchor="middle"
          x="50"
          y="61"
        >
          {dayLabel}
        </text>
      ) : null}
    </SvgIcon>
  );
};

export const UploadIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <g fill="white">
            <circle cx="30" cy="60" r="15" />
            <circle cx="70" cy="60" r="15" />
            <circle cx="50" cy="45" r="22" />
            <rect height="30" width="40" x="30" y="45" />
          </g>
          <g fill="none" stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5">
            <path d="M 50 75 Q 55 65 50 55" />
            <path d="M 34 62 Q 40 55 50 45 Q 60 55 66 62" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const BellUnreadIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <g fill="white" transform="rotate(15, 50, 50)">
            <path d="M 20 80 C 25 70 30 65 35 50 L 35 40 C 35 20 65 20 65 40 L 65 50 C 70 65 75 70 80 80 Z" />
          </g>
          <g fill="none" stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5" transform="rotate(15, 50, 50)">
            <path d="M 34 58 Q 42 48 50 58 T 66 58" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const BellReadIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <g fill="white">
            <path d="M 20 80 C 25 70 30 65 35 50 L 35 40 C 35 20 65 20 65 40 L 65 50 C 70 65 75 70 80 80 Z" />
          </g>
          <g fill="none" stroke="black" strokeLinecap="round" strokeWidth="5.5">
            <path d="M 38 58 L 62 58" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const RemindersIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <rect fill="white" height="60" rx="6" width="70" x="15" y="15" />
          <line stroke="black" strokeLinecap="round" strokeWidth="5.5" x1="26" x2="26" y1="15" y2="75" />
          <path
            d="M 40 12 L 60 12 L 60 60 Q 60 75 68 88 Q 50 94 32 88 Q 40 75 40 60 Z"
            fill="black"
            stroke="black"
            strokeWidth="11"
            strokeLinejoin="round"
          />
          <path d="M 40 12 L 60 12 L 60 60 Q 60 75 68 88 Q 50 94 32 88 Q 40 75 40 60 Z" fill="white" />
          <g fill="none" stroke="black" strokeLinecap="round" strokeWidth="5.5">
            <path d="M 44 45 Q 50 38 56 45" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const TasksIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <rect fill="white" height="60" rx="6" width="64" x="18" y="22" />
          <g fill="none" stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6.5">
            <path d="M 30 55 L 42 67 L 60 43" />
            <path d="M 60 43 L 60 25 Q 60 12 72 12 Q 84 12 84 25 L 84 65 Q 84 75 72 75 Q 60 75 60 65" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const UserIcon = ({ className }: IconGraphicProps) => (
  <SvgIcon className={className} viewBox="0 0 24 24">
    <path d="M12,2 C15,2 18,4 18,7 C18,10 15,12 12,12 C9,12 6,10 6,7 C6,4 9,2 12,2 Z" fill="currentColor" />
    <path
      clipRule="evenodd"
      d="M5,17.5 C5,15.5 8,14.5 12,14.5 C16,14.5 19,15.5 19,17.5 L19,20 C19,22 16,22 12,22 C8,22 5,22 5,20 L5,17.5 Z M9,18 C9.5,17 10.5,19 11,18 C11.5,17 12.5,19 13,18 L13,19.5 C12.5,20.5 11.5,18.5 11,19.5 C10.5,20.5 9.5,18.5 9,19.5 L9,18 Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </SvgIcon>
);

export const MenuIcon = ({ className }: IconGraphicProps) => (
  <SvgIcon className={className} viewBox="0 0 24 24">
    <rect fill="currentColor" height="4" rx="1" width="18" x="3" y="4" />
    <rect fill="currentColor" height="4" rx="1" width="12" x="3" y="11" />
    <rect fill="currentColor" height="4" rx="1" width="18" x="3" y="18" />
  </SvgIcon>
);

export const SettingsIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <path d="M 50 20 L 56 10 L 64 12 L 67 22 L 78 25 L 85 20 L 90 28 L 82 35 L 85 46 L 95 50 L 95 60 L 85 64 L 82 75 L 90 82 L 85 90 L 78 85 L 67 88 L 64 98 L 56 100 L 50 90 L 44 100 L 36 98 L 33 88 L 22 85 L 15 90 L 10 82 L 18 75 L 15 64 L 5 60 L 5 50 L 15 46 L 18 35 L 10 28 L 15 20 L 22 25 L 33 22 L 36 12 L 44 10 Z" fill="white" />
          <g fill="none" stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5">
            <path d="M 35 50 Q 42 40 50 50 T 65 50" />
          </g>
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const BackIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <g fill="white">
            <path d="M 15 50 L 45 25 L 45 40 Q 65 40 85 55 L 85 75 Q 65 60 45 60 L 45 75 Z" />
          </g>
          <rect fill="black" height="30" transform="rotate(-15, 68, 60)" width="6" x="65" y="45" />
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const PinIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <circle cx="50" cy="35" fill="white" r="22" />
          <rect fill="white" height="25" rx="6" width="12" x="44" y="62" />
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

export const EditIcon = ({ className }: IconGraphicProps) => {
  const maskId = useId();

  return (
    <SvgIcon className={className} viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="black" height="100" width="100" />
          <path d="M 30 85 L 15 85 L 15 70 L 65 20 L 80 35 Z" fill="white" />
          <path d="M 72 13 L 87 28 L 80 35 L 65 20 Z" fill="white" />
          <path d="M 60 25 L 75 40" stroke="black" strokeLinecap="round" strokeWidth="6" />
        </mask>
      </defs>
      <rect fill="currentColor" height="100" mask={`url(#${maskId})`} width="100" />
    </SvgIcon>
  );
};

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
  | 'user'
  | 'menu'
  | 'settings'
  | 'back'
  | 'pin'
  | 'edit';

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
  user: UserIcon,
  menu: MenuIcon,
  settings: SettingsIcon,
  back: BackIcon,
  pin: PinIcon,
  edit: EditIcon,
};

interface IconProps extends BaseIconProps {
  label?: string;
  name: IconName;
  date?: Date | number | string;
  timeZone?: string;
}

export const Icon = ({ className, date, label, name, timeZone }: IconProps) => {
  const Component = ICON_MAP[name];

  if (label) {
    return (
      <span aria-label={label} role="img">
        <Component className={className} date={date} timeZone={timeZone} />
      </span>
    );
  }

  return <Component className={className} date={date} timeZone={timeZone} />;
};
