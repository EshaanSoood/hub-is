# Data Layer Branch Check

Branch compared: `origin/Data=Layer-Changes` against `origin/main`

## 1) `git log origin/Data=Layer-Changes --not origin/main --oneline`

```bash
3b5e45d Remove Nextcloud frontend leaks
```

## 2) `git diff origin/main...origin/Data=Layer-Changes --stat`

```bash
 src/components/layout/ProjectShell.tsx |   1 -
 src/data/mockData.ts                   |   4 +-
 src/hooks/useProjectFilesRuntime.ts    |   2 -
 src/lib/blockingInputs.ts              |   6 --
 src/lib/dashboardCards.ts              |   2 +-
 src/lib/env.ts                         |   3 -
 src/services/nextcloudService.ts       | 100 ---------------------------------
 src/services/projectsService.ts        |   4 +-
 src/types/domain.ts                    |   2 -
 9 files changed, 4 insertions(+), 120 deletions(-)
```

## 3) `git diff origin/main...origin/Data=Layer-Changes` (full diff)

```diff
diff --git a/src/components/layout/ProjectShell.tsx b/src/components/layout/ProjectShell.tsx
index f124c6d..c006c51 100644
--- a/src/components/layout/ProjectShell.tsx
+++ b/src/components/layout/ProjectShell.tsx
@@ -31,7 +31,6 @@ export const ProjectShell = ({
             <DataList
               items={[
                 { label: 'OpenProject Project', value: project.openProjectProjectId || 'pending' },
-                { label: 'Nextcloud Folder', value: project.nextcloudFolder || 'pending' },
                 { label: 'Notes Space', value: 'Hub-managed notes (internal)' },
               ]}
             />
diff --git a/src/data/mockData.ts b/src/data/mockData.ts
index 87cb744..9f59f81 100644
--- a/src/data/mockData.ts
+++ b/src/data/mockData.ts
@@ -54,7 +54,6 @@ export const mockProjects: Project[] = [
     linkedExternalIds: {
       keycloakClientId: 'eshaan-os-web',
       openProjectProjectId: '42',
-      nextcloudFolder: '/EshaanOS/BackendPilot',
       invoiceClientId: 'C-1020',
     },
     notes: mockNotes,
@@ -74,7 +73,6 @@ export const mockProjects: Project[] = [
     linkedExternalIds: {
       keycloakClientId: 'eshaan-lessons',
       openProjectProjectId: '58',
-      nextcloudFolder: '/EshaanOS/Lessons',
       invoiceClientId: 'C-2040',
     },
     notes: mockNotes,
@@ -95,7 +93,7 @@ export const mockActivityEvents: ActivityEvent[] = [
     id: 'act-2',
     timestamp: '2026-02-23T01:40:00.000Z',
     category: 'file',
-    message: 'Downloaded incident bundle archive from Nextcloud.',
+    message: 'Downloaded incident bundle archive.',
     projectId: 'backend-pilot',
   },
   {
diff --git a/src/hooks/useProjectFilesRuntime.ts b/src/hooks/useProjectFilesRuntime.ts
index c09b6f3..0d899d9 100644
--- a/src/hooks/useProjectFilesRuntime.ts
+++ b/src/hooks/useProjectFilesRuntime.ts
@@ -122,7 +122,6 @@ export const useProjectFilesRuntime = ({
       }
 
       const created = await createAssetRoot(accessToken, projectId, {
-        provider: 'nextcloud',
         root_path: `/Projects/${slugifyPathSegment(projectName)}-${projectId.slice(-6)}`,
       });
       const nextRoots = await listAssetRoots(accessToken, projectId);
@@ -419,7 +418,6 @@ export const useProjectFilesRuntime = ({
       }
 
       await createAssetRoot(accessToken, projectId, {
-        provider: 'nextcloud',
         root_path: rootPath,
       });
       setNewAssetRootPath('/');
diff --git a/src/lib/blockingInputs.ts b/src/lib/blockingInputs.ts
index e5d6b27..270f233 100644
--- a/src/lib/blockingInputs.ts
+++ b/src/lib/blockingInputs.ts
@@ -12,9 +12,6 @@ const requiredWhenLive: BlockingInput[] = [
   { key: 'VITE_NTFY_TOPIC_URL', reason: 'ntfy topic endpoint' },
   { key: 'VITE_OPENPROJECT_BASE_URL', reason: 'OpenProject base URL' },
   { key: 'VITE_OPENPROJECT_TOKEN', reason: 'OpenProject API token' },
-  { key: 'VITE_NEXTCLOUD_BASE_URL', reason: 'Nextcloud base URL' },
-  { key: 'VITE_NEXTCLOUD_USER', reason: 'Nextcloud username' },
-  { key: 'VITE_NEXTCLOUD_APP_PASSWORD', reason: 'Nextcloud app password' },
   { key: 'VITE_GITHUB_REPOSITORY', reason: 'GitHub repository owner/name' },
   { key: 'VITE_GITHUB_TOKEN', reason: 'GitHub token' },
   { key: 'VITE_N8N_WAKE_WEBHOOK_URL', reason: 'n8n wake workflow webhook URL' },
@@ -28,9 +25,6 @@ const valueByKey: Record<string, string> = {
   VITE_NTFY_TOPIC_URL: env.ntfyTopicUrl,
   VITE_OPENPROJECT_BASE_URL: env.openProjectBaseUrl,
   VITE_OPENPROJECT_TOKEN: env.openProjectToken,
-  VITE_NEXTCLOUD_BASE_URL: env.nextcloudBaseUrl,
-  VITE_NEXTCLOUD_USER: env.nextcloudUser,
-  VITE_NEXTCLOUD_APP_PASSWORD: env.nextcloudAppPassword,
   VITE_GITHUB_REPOSITORY: env.githubRepo,
   VITE_GITHUB_TOKEN: env.githubToken,
   VITE_N8N_WAKE_WEBHOOK_URL: env.n8nWakeWebhook,
diff --git a/src/lib/dashboardCards.ts b/src/lib/dashboardCards.ts
index bb17358..840fe14 100644
--- a/src/lib/dashboardCards.ts
+++ b/src/lib/dashboardCards.ts
@@ -26,7 +26,7 @@ export const dashboardCardRegistry: DashboardCardDefinition[] = [
   {
     id: 'recent-files',
     title: 'Recent Files',
-    description: 'View recent Nextcloud assets and share links.',
+    description: 'View recent files and share links.',
     requiredGlobalCapabilities: ['hub.view'],
     requiredProjectCapability: 'project.files.view',
     projectScopeRequired: true,
diff --git a/src/lib/env.ts b/src/lib/env.ts
index 3dbf9f5..ae08233 100644
--- a/src/lib/env.ts
+++ b/src/lib/env.ts
@@ -64,9 +64,6 @@ export const env = {
   ntfyTopicUrl: read('VITE_NTFY_TOPIC_URL'),
   openProjectBaseUrl: read('VITE_OPENPROJECT_BASE_URL'),
   openProjectToken: read('VITE_OPENPROJECT_TOKEN'),
-  nextcloudBaseUrl: read('VITE_NEXTCLOUD_BASE_URL'),
-  nextcloudUser: read('VITE_NEXTCLOUD_USER'),
-  nextcloudAppPassword: read('VITE_NEXTCLOUD_APP_PASSWORD'),
   githubRepo: read('VITE_GITHUB_REPOSITORY'),
   githubToken: read('VITE_GITHUB_TOKEN'),
   hubDevAuthEnabled: canEnableDevAuthClient(),
diff --git a/src/services/nextcloudService.ts b/src/services/nextcloudService.ts
deleted file mode 100644
index 49207e0..0000000
--- a/src/services/nextcloudService.ts
+++ /dev/null
@@ -1,100 +0,0 @@
-import { mockFiles, nowIso } from '../data/mockData';
-import { env } from '../lib/env';
-import type { HubFile, IntegrationOutcome } from '../types/domain';
-
-export const listRecentFiles = async (): Promise<IntegrationOutcome<HubFile[]>> => {
-  if (env.useMocks) {
-    return { data: mockFiles };
-  }
-
-  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
-    return {
-      blockedReason:
-        'Set VITE_NEXTCLOUD_BASE_URL, VITE_NEXTCLOUD_USER, and VITE_NEXTCLOUD_APP_PASSWORD for Nextcloud APIs.',
-    };
-  }
-
-  return { data: mockFiles };
-};
-
-export const createFolder = async (
-  folderName: string,
-): Promise<IntegrationOutcome<{ folderName: string }>> => {
-  if (env.useMocks) {
-    return { data: { folderName } };
-  }
-
-  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
-    return {
-      blockedReason:
-        'Set Nextcloud credentials to create folders in the live environment.',
-    };
-  }
-
-  return { data: { folderName } };
-};
-
-export const generateShareLink = async (
-  fileId: string,
-): Promise<IntegrationOutcome<{ fileId: string; shareUrl: string }>> => {
-  if (env.useMocks) {
-    return {
-      data: {
-        fileId,
-        shareUrl: `https://cloud.eshaansood.org/s/${fileId}-share`,
-      },
-    };
-  }
-
-  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
-    return {
-      blockedReason:
-        'Set Nextcloud credentials to generate secure share links.',
-    };
-  }
-
-  return {
-    data: {
-      fileId,
-      shareUrl: `${env.nextcloudBaseUrl}/s/${fileId}`,
-    },
-  };
-};
-
-export const requestDownloadBundle = async (): Promise<IntegrationOutcome<{ createdAt: string }>> => {
-  if (env.useMocks) {
-    return { data: { createdAt: nowIso() } };
-  }
-
-  if (!env.n8nWakeWebhook) {
-    return {
-      blockedReason: 'Set VITE_N8N_WAKE_WEBHOOK_URL to trigger download bundle automation.',
-    };
-  }
-
-  return { data: { createdAt: nowIso() } };
-};
-
-export const uploadFile = async (
-  file: File,
-): Promise<IntegrationOutcome<HubFile>> => {
-  const uploaded: HubFile = {
-    id: `upload-${Date.now()}`,
-    name: file.name,
-    updatedAt: nowIso(),
-    size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
-  };
-
-  if (env.useMocks) {
-    return { data: uploaded };
-  }
-
-  if (!env.nextcloudBaseUrl || !env.nextcloudUser || !env.nextcloudAppPassword) {
-    return {
-      blockedReason:
-        'Set Nextcloud credentials to upload files in the live environment.',
-    };
-  }
-
-  return { data: uploaded };
-};
diff --git a/src/services/projectsService.ts b/src/services/projectsService.ts
index 0519459..fae6358 100644
--- a/src/services/projectsService.ts
+++ b/src/services/projectsService.ts
@@ -10,6 +10,7 @@ import type {
   IntegrationOutcome,
   ProjectMembership,
   ProjectRecord,
+  ServiceRegistryItem,
 } from '../types/domain';
 import type { HubEnvelope, HubProject } from './hub/types';
 import { buildHubAuthHeaders } from './hubAuthHeaders';
@@ -73,7 +74,6 @@ const toProjectRecord = (project: HubProject): ProjectRecord => ({
   status: 'active',
   summary: '',
   openProjectProjectId: null,
-  nextcloudFolder: null,
   membershipRole:
     project.membership_role === 'owner' || project.membership_role === 'member'
       ? project.membership_role
@@ -153,7 +153,7 @@ export const createHubInvite = async (
 
 export const requestOwnerEdgeGrant = async (
   accessToken: string,
-  serviceId: 'nextcloud' | 'openproject',
+  serviceId: ServiceRegistryItem['id'],
 ): Promise<IntegrationOutcome<{ openUrl: string; serviceId: string }>> => {
   try {
     const response = await fetch('/api/hub/edge/grants', {
diff --git a/src/types/domain.ts b/src/types/domain.ts
index a5f5411..936879a 100644
--- a/src/types/domain.ts
+++ b/src/types/domain.ts
@@ -42,7 +42,6 @@ export interface Project {
   linkedExternalIds: {
     keycloakClientId: string;
     openProjectProjectId: string;
-    nextcloudFolder: string;
     invoiceClientId: string;
   };
   notes: HubNote[];
@@ -56,7 +55,6 @@ export interface ProjectRecord {
   status: 'active' | 'paused';
   summary: string;
   openProjectProjectId: string | null;
-  nextcloudFolder: string | null;
   membershipRole: ProjectMembership['role'];
 }
 
```

## 4) File-by-file relevance check against `origin/main`

- `src/components/layout/ProjectShell.tsx`
  - Exists on `origin/main`: Yes
  - Changed line status: The removed line still exists on `origin/main` (`Nextcloud Folder` row is still rendered).

- `src/data/mockData.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: The two exact removed `nextcloudFolder` lines from the branch do not exist verbatim, but equivalent `nextcloudFolder` entries still exist on `origin/main` with different values (`/HubOS/...`). The removed activity message line (`from Nextcloud`) still exists exactly.

- `src/hooks/useProjectFilesRuntime.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: Removed `provider: 'nextcloud'` lines still exist on `origin/main`.

- `src/lib/blockingInputs.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: All removed Nextcloud-related required keys and `valueByKey` mappings still exist on `origin/main`.

- `src/lib/dashboardCards.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: Removed description text (`Nextcloud assets`) still exists on `origin/main`.

- `src/lib/env.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: Removed Nextcloud env reads (`nextcloudBaseUrl`, `nextcloudUser`, `nextcloudAppPassword`) still exist on `origin/main`.

- `src/services/nextcloudService.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: File is still present on `origin/main`; branch deletes it entirely. Deleted content still exists on `origin/main`.

- `src/services/projectsService.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: Branch changes are still relevant: `serviceId` is still `'nextcloud' | 'openproject'` on `origin/main`, and `nextcloudFolder: null` mapping still exists there.

- `src/types/domain.ts`
  - Exists on `origin/main`: Yes
  - Changed line status: `Project.linkedExternalIds.nextcloudFolder: string` still exists on `origin/main`. However, `ProjectRecord` has been refactored on `origin/main` to `type ProjectRecord = SharedProjectRecord`, so the exact removed line `nextcloudFolder: string | null` is not present as a direct field in this file.

Additional merge signal:

- `git merge-tree $(git merge-base origin/main origin/Data=Layer-Changes) origin/main origin/Data=Layer-Changes` shows overlapping edits/conflicts in:
  - `src/data/mockData.ts`
  - `src/lib/dashboardCards.ts`
  - `src/lib/env.ts`
  - `src/services/projectsService.ts`
  - `src/types/domain.ts`

## 5) Conclusion

**Conflicts likely — needs manual review.**

The branch changes are largely still relevant (most targeted Nextcloud lines still exist on `origin/main`), but `origin/main` has diverged in several of the same files, and `merge-tree` indicates real overlap/conflict regions.
