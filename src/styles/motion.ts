// Motion tokens are based on Material motion timing/easing tokens.
// Source: https://raw.githubusercontent.com/material-foundation/material-tokens/refs/heads/main/css/motion.css

export const motionDurations = {
  enter: 0.3,
  exit: 0.2,
  lateral: 0.3,
  fade: 0.2,
  reduced: 0.12,
} as const;

export const motionDistances = {
  depthEnter: 24,
  depthExit: 16,
  lateralOffset: 30,
  reducedOffset: 8,
  popoverScaleStart: 0.95,
  fadeThroughScaleStart: 0.98,
} as const;

export const motionEasings = {
  // Material emphasized decelerate
  enter: [0.05, 0.7, 0.1, 1] as const,
  // Material emphasized accelerate
  exit: [0.3, 0, 0.8, 0.15] as const,
  // Material standard
  lateral: [0.2, 0, 0, 1] as const,
  // Material linear
  fade: [0, 0, 1, 1] as const,
} as const;

export const motionDirection = {
  left: -1,
  none: 0,
  right: 1,
} as const;

export type MotionDirection = (typeof motionDirection)[keyof typeof motionDirection];

export const dialogLayoutIds = {
  recordInspector: 'dialog-record-inspector',
  mobileModules: 'dialog-mobile-modules',
  toolbarCalendar: 'dialog-toolbar-calendar',
  toolbarTasks: 'dialog-toolbar-tasks',
  toolbarReminders: 'dialog-toolbar-reminders',
  myHubRecordInspector: 'dialog-myhub-record-inspector',
  paneSettings: 'dialog-pane-settings',
  commentOnBlock: 'dialog-comment-on-block',
  addModule: 'dialog-add-module',
  taskCreate: 'dialog-task-create',
  quickAddEvent: 'dialog-quick-add-event',
  quickAddReminder: 'dialog-quick-add-reminder',
  quickAddProject: 'dialog-quick-add-project',
  deleteAutomationRule: 'dialog-delete-automation-rule',
  removeFile: 'dialog-remove-file',
} as const;
