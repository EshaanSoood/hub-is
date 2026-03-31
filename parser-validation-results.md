# Parser Validation Results

Reference Now: 2026-03-27T14:00:00.000Z
Timezone: America/New_York

## Task Parser Results

| Input | Title | Date/Time | Recurrence | Priority | Warnings |
| --- | --- | --- | --- | --- | --- |
| remind me to call mom next month | Call Mom | 2026-04-27T10:00:00 | — | — | intent_mismatch_reminder: Input looks more like a reminder than a task. |
| in 3 days finish the report | Finish the Report | 2026-03-30T10:00:00 | — | — | — |
| water plants daily | Water Plants | — | — | — | intent_mismatch_reminder: Input looks more like a reminder than a task.<br />no_due_date: No due date extracted — consider adding one for visibility. |
| check in with team every other week | Check in with Team | — | — | — | intent_mismatch_reminder: Input looks more like a reminder than a task.<br />no_due_date: No due date extracted — consider adding one for visibility. |
| urgent fix the login bug by friday for @mark | Fix the Login Bug | 2026-03-27T12:00:00 | — | high | — |
| buy groceries tomorrow morning | Buy Groceries | 2026-03-28T06:00:00 | — | — | — |
| schedule dentist appointment next month at 3pm | Schedule Dentist Appointment | 2026-04-27T15:00:00 | — | — | — |
| remind me in 2 weeks to renew subscription | Renew Subscription | 2026-04-10T10:00:00 | — | — | intent_mismatch_reminder: Input looks more like a reminder than a task. |
| submit expenses end of month | Submit Expenses | 2026-03-31T23:59:00 | — | — | — |
| meeting with sarah next monday at noon | Meeting with Sarah | 2026-03-30T12:00:00 | — | — | — |
| remind me tonight to take out trash | Take Out Trash | 2026-03-27T22:00:00 | — | — | intent_mismatch_reminder: Input looks more like a reminder than a task. |
| high priority review PR by end of day | Review PR | 2026-03-27T23:59:00 | — | high | — |
| in 1 month plan the offsite | Plan the Offsite | 2026-04-27T10:00:00 | — | — | — |
| remind me every other day to stretch | To Stretch | — | — | — | intent_mismatch_reminder: Input looks more like a reminder than a task.<br />no_due_date: No due date extracted — consider adding one for visibility. |
| call insurance company in 3 hours | Call Insurance Company | 2026-03-27T13:00:00 | — | — | — |

## Reminder Parser Results

| Input | Title | Date/Time | Recurrence | Priority | Warnings |
| --- | --- | --- | --- | --- | --- |
| remind me to call mom next month | Call Mom | 2026-04-27T09:00:00 | — | — | — |
| in 3 days finish the report | Finish the Report | 2026-03-30T09:00:00 | — | — | — |
| water plants daily | Water Plants | 2026-03-28T09:00:00 | {"frequency":"daily","interval":1,"days":null} | — | — |
| check in with team every other week | Check in with Team | — | {"frequency":"weekly","interval":2,"days":null} | — | no_remind_time: No time specified for reminder. |
| urgent fix the login bug by friday for @mark | Fix the Login Bug | 2026-03-27T09:00:00 | — | — | remind_at_past: Reminder time is in the past. |
| buy groceries tomorrow morning | Buy Groceries | 2026-03-28T09:00:00 | — | — | — |
| schedule dentist appointment next month at 3pm | Schedule Dentist Appointment | 2026-04-27T15:00:00 | — | — | — |
| remind me in 2 weeks to renew subscription | Renew Subscription | 2026-04-10T09:00:00 | — | — | — |
| submit expenses end of month | Submit Expenses | 2026-03-31T09:00:00 | — | — | — |
| meeting with sarah next monday at noon | Meeting with Sarah | 2026-03-30T12:00:00 | — | — | — |
| remind me tonight to take out trash | Take Out Trash | 2026-03-27T20:00:00 | — | — | — |
| high priority review PR by end of day | Review PR | 2026-03-27T17:00:00 | — | — | — |
| in 1 month plan the offsite | Plan the Offsite | 2026-04-27T09:00:00 | — | — | — |
| remind me every other day to stretch | Stretch | — | {"frequency":"daily","interval":2,"days":null} | — | no_remind_time: No time specified for reminder. |
| call insurance company in 3 hours | Call Insurance Company | 2026-03-27T13:00:00 | — | — | — |

## Calendar Parser Results

| Input | Title | Date/Time | Recurrence | Priority | Warnings |
| --- | --- | --- | --- | --- | --- |
| remind me to call mom next month | Call Mom | 2026-04-27 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| in 3 days finish the report | Finish The Report | 2026-03-30 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| water plants daily | Water Plants | — | {"frequency":"daily","interval":1,"days":null,"exceptions":null,"end_date":null} | — | — |
| check in with team every other week | Check In With Team | — | {"frequency":"weekly","interval":2,"days":null,"exceptions":null,"end_date":null} | — | — |
| urgent fix the login bug by friday for @mark | Fix The Login Bug | 2026-03-27 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| buy groceries tomorrow morning | Buy Groceries | 2026-03-28 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| schedule dentist appointment next month at 3pm | Schedule Dentist Appointment | 2026-04-27 15:00 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| remind me in 2 weeks to renew subscription | Renew Subscription | 2026-04-10 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| submit expenses end of month | Submit Expenses | 2026-03-31 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| meeting with sarah next monday at noon | Meeting With Sarah | 2026-03-30 12:00 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| remind me tonight to take out trash | Take Out Trash | 2026-03-27 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| high priority review PR by end of day | Review PR | 2026-03-27 17:00 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| in 1 month plan the offsite | Plan The Offsite | 2026-04-27 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
| remind me every other day to stretch | Stretch | — | {"frequency":"daily","interval":2,"days":null,"exceptions":null,"end_date":null} | — | — |
| call insurance company in 3 hours | Call Insurance Company | 2026-03-27 13:00 | {"frequency":null,"interval":null,"days":null,"exceptions":null,"end_date":null} | — | — |
