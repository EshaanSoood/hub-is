# Facets Access Model Architecture

This document is the source of truth for the Facets access model. Both the current Hocuspocus implementation and the future SecSync rebuild reference this spec. Schema and predicate names defined here are durable artifacts — they survive across implementation changes.

---

## Roles

Five roles exist on `space_members`. All five are in the enum from day one to avoid future migration.

| Role | Permanent | Project-scoped | Billing |
|---|---|---|---|
| Owner | Yes | Full access | Pays for the space |
| Admin | Yes | Full access | Paid seat |
| Member | Yes | Visible projects | Paid seat |
| Viewer | No (default 7 days) | Assigned projects only | Free |
| Guest | No (30 days) | Assigned projects only | Free (within window) |

---

## Permission Matrix

### Space-Level Actions

| Action | Owner | Admin | Member | Viewer | Guest |
|---|---|---|---|---|---|
| Create space | Yes | — | — | — | — |
| Delete space (3-day countdown, all members notified) | Yes | No | No | No | No |
| Rename space / change space settings | Yes | No | No | No | No |
| Transfer ownership (requires recipient acceptance) | Yes | No | No | No | No |
| Leave space | Only after transferring ownership | Yes | Yes | Yes | Yes |
| Set admins | Yes | No | No | No | No |
| Remove admins | Yes | No | No | No | No |
| Auto-approve new members | Yes | No | No | No | No |
| Auto-approve new guests | Yes | Yes | No | No | No |
| Invite members and guests (needs approval) | Yes | Yes | Yes | No | No |
| Revoke members and guests | Yes | Yes (not owner, not other admins) | No | No | No |
| Add space-scoped content (calendar, tasks, etc.) | Yes | Yes | No | No | No |
| See Overview tab | Yes | Yes | Yes | No | No |

### Project-Level Actions

| Action | Owner | Admin | Member | Viewer | Guest |
|---|---|---|---|---|---|
| Create projects | Yes | Yes | Yes | No | No |
| Delete projects | Yes | No | No | No | No |
| Hide/unhide projects from specific members | Yes | Yes | No | No | No |
| Assign members to projects | Yes | Yes | Yes | No | No |
| Add project-scoped content (tasks, docs, files, etc.) | Yes | Yes | Yes | No | Yes (assigned projects) |
| Edit project-scoped content | Yes | Yes | Yes | No | Yes (assigned projects) |
| Comment | Yes | Yes | Yes | Yes (assigned projects) | Yes (assigned projects) |
| See projects | All | All | Visible only | Assigned only | Assigned only |

### Home Roll-Up

The Home roll-up is user-scoped, not role-scoped. It aggregates all data the user has access to across all spaces they belong to. The role determines the access surface (which projects, what actions), and the roll-up reflects whatever that surface contains.

---

## Project Visibility

- Default: visible to all space members.
- Owner and admins can hide a project from specific members.
- Owner and admins can unhide (restore visibility) for specific members.
- Members cannot hide projects from anyone.
- Guests and viewers only see projects they are explicitly assigned to — the visibility system does not apply to them.

---

## Time Limits and Billing

### Guests

- 30-day access window per space, starting on acceptance.
- 90-day cooldown per space: the same account cannot be re-invited as a guest to the same space within 90 days of their original invite date.
- No cross-space restrictions: a person can be a guest in multiple spaces simultaneously.
- Owner receives expiry reminders at 7 days, 3 days, and 1 day before the guest's access expires.
- At expiry, three options: upgrade to paid member, purchase a paid time extension (Guest+), or access is cut.
- When re-inviting an account that has an active cooldown, the inviter is shown two options: invite as a paid member, or purchase Guest+ for a time extension.
- The inviter sees the guest rules (time limit, cooldown) during the invite flow.

### Viewers

- Default 7-day access window, adjustable by the inviter at invite time.
- No cooldown: unlimited re-invites of the same account.
- No expiry reminders to the owner.
- Can be upgraded to guest or member at any time.

### Permanent Roles

- Owner, admin, and member have no time limits.
- All three are paid seats.

---

## Invite Flow

### Owner Invites

- Owner adds members → auto-approved.
- Owner adds guests → auto-approved.
- Owner adds admins → auto-approved.
- Owner adds viewers → auto-approved.

### Admin Invites

- Admin adds guests → auto-approved.
- Admin adds members → requires owner approval (billing impact).
- Admin adds viewers → auto-approved.
- Admin cannot add other admins.

### Member Invites

- Member invites members → requires owner or admin approval.
- Member invites guests → requires owner or admin approval.
- Member invites viewers → requires owner or admin approval.
- Member cannot invite admins.

### Guest and Viewer Invites

- Guests and viewers cannot invite anyone.

### Pending Invite Edge Cases

- If a guest invite includes specific projects and one of those projects is deleted before the invite is accepted, the invite remains valid for the remaining projects. If all projects are deleted, the invite becomes void.
- A guest can be assigned to additional projects after their initial invite without re-inviting.

---

## Revocation and Removal

### Who Can Revoke

- Owner can revoke anyone.
- Admin can revoke members, guests, and viewers. Cannot revoke the owner or other admins.
- Members, viewers, and guests cannot revoke anyone.

### Content on Removal

- When any role is removed or expires, their content (tasks, docs, comments, files) stays in the projects.
- Attribution is preserved as dead links: the person's name appears on their content but is not clickable and does not link to a profile.
- Same behavior for all roles — owner removal, admin removal, member removal, guest expiry, viewer expiry.

### Guest Auto-Removal

- If all projects a guest is assigned to are deleted, the guest is automatically removed from the space.
- Same applies to viewers.

---

## Role Upgrades

- Viewer → Guest: resets the clock to 30 days. Cooldown rules for the guest role apply from this point.
- Viewer → Member: becomes a paid seat. No time limit.
- Guest → Member: becomes a paid seat. No time limit. Cooldown is cleared.
- Member → Admin: owner-only action.
- Any downgrade (e.g. admin → member) is also an owner-only action.

---

## Personal Spaces

- Every user has at least one personal space. Deletion of the last personal space is blocked (409 error).
- Users can have multiple personal spaces.
- A personal space is a regular space with an `isPersonal` flag where the user is the sole owner.
- Personal spaces appear in the sidebar Spaces list alongside all other spaces.
- Personal spaces do not have other members — they are single-owner spaces.

---

## Space Deletion

- Only the owner can initiate space deletion.
- Deletion is not immediate. A `pending_deletion_at` timestamp is set to 3 days from initiation.
- All members are notified immediately that the space is scheduled for deletion.
- During the 3-day window, the space remains accessible. The owner can cancel the deletion.
- After 3 days, the space and all its data are permanently deleted.

---

## Named Permission Predicates

These function names are durable — call sites stay the same across Hocuspocus and SecSync implementations. Only the function bodies change.

```
canUserAccessProject(userId, projectId)
```
Returns true if the user can see this project. Checks: space membership, role, project visibility settings, and guest/viewer project assignments.

```
canUserAccessSpaceOverview(userId, spaceId)
```
Returns true if the user can see the space Overview tab. Returns false for viewers and guests.

```
canUserManageSpaceMembers(userId, spaceId)
```
Returns true if the user can invite, approve, or revoke members. Returns true for owner and admin.

```
canUserEditProject(userId, projectId)
```
Returns true if the user can create/edit content in this project. Returns false for viewers (they can only comment).

```
canUserDeleteSpace(userId, spaceId)
```
Returns true only for the owner.

```
canUserManageProjectVisibility(userId, spaceId)
```
Returns true for owner and admin. They can hide/unhide projects from specific members.

---

## Schema Implications

### Modified Tables

**`space_members`**
- `role` TEXT NOT NULL — enum: `'owner'`, `'admin'`, `'member'`, `'viewer'`, `'guest'`
- `expires_at` TEXT — nullable. Set for viewers (invite date + duration) and guests (acceptance date + 30 days). Null for permanent roles.
- `invited_by` TEXT — FK to users. Who sent the invite.
- `approved_by` TEXT — nullable FK to users. Who approved the invite. Null for auto-approved invites.
- `cooldown_until` TEXT — nullable. For guests: set to `joined_at` + 90 days on removal/expiry. Used to enforce the re-invite cooldown.

**`spaces`**
- `pending_deletion_at` TEXT — nullable. When set, the space is scheduled for deletion at this timestamp.

**`pending_space_invites`**
- `role` TEXT NOT NULL — enum expanded to all five roles.
- `expires_after_days` INTEGER — nullable. For viewers: the custom duration. For guests: always 30.

### New Tables

**`space_member_project_access`**
- `space_id` TEXT NOT NULL
- `user_id` TEXT NOT NULL
- `project_id` TEXT NOT NULL
- `access_level` TEXT NOT NULL DEFAULT 'write' — `'read'` for viewers, `'write'` for guests.
- `granted_at` TEXT NOT NULL
- `granted_by` TEXT NOT NULL — FK to users.
- Composite FK to `space_members(space_id, user_id)`.
- Trigger: rows can only exist for users whose role is `'viewer'` or `'guest'`.

**`pending_space_invite_projects`**
- `invite_id` TEXT NOT NULL — FK to `pending_space_invites`.
- `project_id` TEXT NOT NULL — FK to `projects`.
- Links pending guest/viewer invites to specific projects they will get access to.

### Indexes

- `space_member_project_access(space_id, user_id, project_id)` — unique composite.
- `space_member_project_access(project_id)` — for "who has access to this project" lookups.
- `pending_space_invite_projects(invite_id)` — for "which projects are on this invite" lookups.

---

## Architecture Note

The Hocuspocus implementation of this access model is the design exercise for the SecSync model. The Hocuspocus implementation is not preserved in data (clean slate at Tauri rebuild) but is preserved in concept: roles, predicates, access surface, what each role sees and doesn't see. Whatever shape the Hocuspocus version settles into is the spec for the SecSync rebuild.

Schema and predicate names are not throwaway — they are the artifact that survives.
