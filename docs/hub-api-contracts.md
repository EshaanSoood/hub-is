# Hub API Contracts (UI + Providers)

Last updated: 2026-03-02

This document defines the stable Hub API surface that the UI can depend on for tasks, calendar, timeline, and notifications.

## Auth model

- `member-only`: any authenticated project member (or owner) can call.
- `owner-only`: only canonical owner can call.

All endpoints use bearer auth (`Authorization: Bearer <token>`). Failed auth returns `401` or `403`.

## Common error codes

- `400`: invalid body/query/path shape.
- `401`: missing/invalid/expired auth token.
- `403`: authenticated but forbidden by role/scope/membership.
- `404`: resource not found in requested scope.
- `409`: integration/provider conflict (for integration-backed flows).
- `500`: internal server error.
- `503`: provider misconfigured/unavailable.

## Types

```ts
type CalendarOccurrence = {
  occurrenceId: string;
  seriesId: string | null;
  eventId: string | null;
  title: string;
  startsAt: string; // ISO timestamp
  endsAt: string | null; // ISO timestamp
  allDay: boolean;
  location: string | null;
  description: string | null;
  source: 'oneoff' | 'series';
  timezone: string;
  attendees: string[] | null;
  alerts: Array<{ offset_minutes: number }> | null;
  isException: boolean;
};

type TimelinePageInfo = {
  hasMore: boolean;
  nextCursor: string | null;
};
```

## Stable endpoints

### Tasks

#### Mine scope
- `GET /api/hub/tasks` (`member-only`)
- Query: `status=open|done` (optional)
- Response:
```json
{ "tasks": [/* Task[] */] }
```

#### Personal scope
- `POST /api/hub/tasks` (`member-only`)
- Body:
```json
{
  "title": "string",
  "description": "string?",
  "category": "string?",
  "startsAt": "ISO?",
  "dueAt": "ISO?"
}
```
- Response:
```json
{ "task": { /* Task */ } }
```

#### Project scope
- `GET /api/hub/projects/:projectId/tasks` (`member-only`)
- Query: `status`, `assignee`, `category`, `dueStart`, `dueEnd` (all optional)
- Response:
```json
{ "tasks": [/* Task[] */] }
```

- `POST /api/hub/projects/:projectId/tasks` (`member-only`)
- `PATCH /api/hub/projects/:projectId/tasks/:taskId` (`member-only`)
- `DELETE /api/hub/projects/:projectId/tasks/:taskId` (`member-only`)
- `POST /api/hub/projects/:projectId/tasks/:taskId/complete` (`member-only`)
- `POST /api/hub/projects/:projectId/tasks/:taskId/reopen` (`member-only`)

- Timer:
  - `POST /api/hub/tasks/:taskId/timer/start` (`member-only`)
  - `POST /api/hub/tasks/:taskId/timer/stop` (`member-only`)
  - `GET /api/hub/tasks/:taskId/time-entries` (`member-only`)

### Calendar

#### Project scope
- `GET /api/hub/projects/:projectId/calendar` (`member-only`)
- Query: `start`, `end` (ISO timestamps, optional)
- Response:
```json
{
  "occurrences": [/* CalendarOccurrence[] */],
  "range": { "start": "ISO|null", "end": "ISO|null" }
}
```

- `POST /api/hub/projects/:projectId/calendar` (`member-only`) creates one-off event
- `PATCH /api/hub/projects/:projectId/calendar/:eventId` (`member-only`) updates one-off event
- `DELETE /api/hub/projects/:projectId/calendar/:eventId` (`member-only`) deletes one-off event

- `POST /api/hub/projects/:projectId/calendar/ingest` (`member-only`) creates one-off or recurring schedule from NLP parse output
- Body:
```json
{
  "sourceText": "string?",
  "parsed": {
    "fields": {
      "title": "string?",
      "description": "string?",
      "date": "YYYY-MM-DD?",
      "time": "HH:MM?",
      "end_time": "HH:MM?",
      "duration_minutes": 60,
      "location": "string?",
      "attendees": ["email@example.com"],
      "alerts": [{ "offset_minutes": 15 }],
      "recurrence": {
        "frequency": "daily|weekly|monthly|yearly",
        "interval": 1,
        "days": ["monday", "wednesday"],
        "end_date": "YYYY-MM-DD?",
        "exceptions": ["YYYY-MM-DD"]
      }
    },
    "warnings": []
  },
  "options": { "timezone": "America/New_York?" }
}
```
- Response:
```json
{
  "created": [/* CalendarOccurrence[] */],
  "series": { /* CalendarSeries|null */ },
  "warnings": [/* parser warnings */]
}
```

- ICS export:
  - `GET /api/hub/projects/:projectId/calendar.ics` (`member-only`)

#### Personal scope
- `GET /api/hub/calendar` (`member-only`)
- `POST /api/hub/calendar` (`member-only`) creates one-off event
- `POST /api/hub/calendar/ingest` (`member-only`) NLP ingest (same body/response as project ingest)
- `GET /api/hub/calendar.ics` (`member-only`)

### Timeline

- `GET /api/hub/projects/:projectId/timeline` (`member-only`)
- Query:
  - `limit` default `50`, max `100`
  - `cursor` opaque cursor from previous page
- Response:
```json
{
  "timeline": [/* newest-first */],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "string|null"
  }
}
```

### Notifications

- `GET /api/hub/notifications` (`member-only`)
- Query:
  - `unread=1|true` optional
  - `limit` optional (max `250`)
- Response:
```json
{ "notifications": [/* Notification[] */] }
```

- `POST /api/hub/notifications/:notificationId/read` (`member-only`)
- Response:
```json
{ "notification": { /* Notification with readAt */ } }
```

## Scope semantics (normative)

- Tasks:
  - `mine`: `GET /api/hub/tasks` (assigned to caller, includes personal tasks authored by caller).
  - `project`: `/api/hub/projects/:projectId/tasks` (project-scoped tasks).
  - `personal`: `POST /api/hub/tasks` for personal task creation.

- Calendar:
  - `project`: `/api/hub/projects/:projectId/calendar` and `/calendar/ingest`.
  - `personal`: `/api/hub/calendar` and `/calendar/ingest`.
  - List responses are normalized occurrence lists (`occurrences`) and include both one-off and expanded recurring occurrences.

- Timeline:
  - Strict newest-first ordering.
  - Cursor pagination is stable (`created_at DESC`, tie-broken by id).

- Notifications:
  - `GET` supports unread filtering.
  - `POST .../read` marks a single notification as read.

## Owner-only endpoints (outside UI member surface)

- `POST /api/hub/projects`
- `DELETE /api/hub/projects/:projectId`
- `GET /api/hub/invites`
- `DELETE /api/hub/invites/:inviteId`
- project invite/member-management mutation endpoints
