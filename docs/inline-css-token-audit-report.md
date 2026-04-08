# Inline CSS Token Audit Report

Generated: 2026-03-29T02:17:04.154Z

Scope: JSX `style={...}` usage across `*.tsx`, `*.jsx`, `*.ts`, `*.js` files.
Rule: A style value is flagged when it has no `var(--token)` reference or only references tokens not defined in `tokens.css`.

Token source: `tokens.css` (81 token variables detected).

Total flagged style properties: 42
Locations with unresolved/non-object style expressions (manual review): 1

## Flagged Non-Token Inline Style Properties

| File | Line | CSS Property | CSS Value | Reason |
| --- | ---: | --- | --- | --- |
| src/components/hub-home/DayStrip.tsx | 358 | `left` | `\`${left}%\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 358 | `width` | `\`${widthPxForEvent}px\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 383 | `left` | `\`${left}%\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 395 | `top` | `\`${markerTop}px\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 403 | `top` | `\`${labelTop}px\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 415 | `left` | `\`${left}%\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 429 | `top` | `\`${markerTop}px\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 435 | `top` | `\`${labelTop}px\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 464 | `width` | `\`${widthPx}px\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 480 | `left` | `\`${nowPercent}%\`` | no token reference |
| src/components/hub-home/DayStrip.tsx | 486 | `left` | `\`${left}%\`` | no token reference |
| src/components/layout/NotificationsPanel.tsx | 100 | `background` | `notification.avatarColor` | no token reference |
| src/components/project-space/FilesModuleSkin.tsx | 168 | `width` | `\`${Math.min(progress, 100)}%\`` | no token reference |
| src/components/project-space/FilesModuleSkin.tsx | 177 | `animation` | `'sparkle-out 0.4s ease-out forwards'` | no token reference |
| src/components/project-space/FilesModuleSkin.tsx | 177 | `['--angle' as string]` | `sparkle.angle` | no token reference |
| src/components/project-space/FilesModuleSkin.tsx | 177 | `['--travel' as string]` | `sparkle.travel` | no token reference |
| src/components/project-space/FilesModuleSkin.tsx | 189 | `animation` | `'fade-in-out 1.5s ease forwards'` | no token reference |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 197 | `opacity` | `entry.archived ? 0.6 : 1` | no token reference |
| src/components/project-space/KanbanModuleSkin.tsx | 117 | `transform` | `CSS.Transform.toString(transform)` | no token reference |
| src/components/project-space/KanbanModuleSkin.tsx | 117 | `opacity` | `isDragging ? 0.65 : 1` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 469 | `width` | `\`${particle.size}px\`` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 469 | `height` | `\`${particle.size}px\`` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 469 | `backgroundColor` | `particle.color` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 469 | `'--sparkle-x'` | `\`${particle.x}px\`` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 469 | `'--sparkle-y'` | `\`${particle.y}px\`` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 469 | `'--sparkle-duration'` | `\`${particle.duration}ms\`` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 469 | `'--sparkle-delay'` | `\`${particle.delay}ms\`` | no token reference |
| src/components/project-space/RemindersModuleSkin.tsx | 494 | `clipPath` | `'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)'` | no token reference |
| src/components/project-space/TableModuleSkin.tsx | 179 | `gridTemplateColumns` | `templateColumns` | no token reference |
| src/components/project-space/TableModuleSkin.tsx | 230 | `height` | `\`${virtualizer.getTotalSize()}px\`` | no token reference |
| src/components/project-space/TableModuleSkin.tsx | 230 | `position` | `'relative'` | no token reference |
| src/components/project-space/TableModuleSkin.tsx | 269 | `transform` | `\`translateY(${item.start}px)\`` | no token reference |
| src/components/project-space/TableModuleSkin.tsx | 269 | `gridTemplateColumns` | `templateColumns` | no token reference |
| src/components/project-space/TableModuleSkin.tsx | 269 | `height` | `\`${item.size}px\`` | no token reference |
| src/components/project-space/TasksTab.tsx | 340 | `paddingLeft` | `\`${contentPadding}px\`` | no token reference |
| src/components/project-space/TasksTab.tsx | 343 | `left` | `\`${connectorLeft}px\`` | no token reference |
| src/components/project-space/TasksTab.tsx | 343 | `width` | `\`${metrics.width}px\`` | no token reference |
| src/components/project-space/TasksTab.tsx | 343 | `opacity` | `metrics.opacity` | no token reference |
| src/pages/ProjectSpacePage.tsx | 935 | `display` | `'-webkit-box'` | no token reference |
| src/pages/ProjectSpacePage.tsx | 935 | `overflow` | `'hidden'` | no token reference |
| src/pages/ProjectSpacePage.tsx | 935 | `WebkitBoxOrient` | `'vertical'` | no token reference |
| src/pages/ProjectSpacePage.tsx | 935 | `WebkitLineClamp` | `2` | no token reference |

## Manual Review Required

These `style` expressions could not be fully resolved to object literals in static analysis:

- src/features/PersonalizedDashboardPanel.tsx:626
  - Expression: `{ background }`
  - Note: shorthand assignment requires manual review (background)
