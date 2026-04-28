import { URL } from 'node:url';

export const createRequestRouter = ({
  applyRequestContext,
  send,
  jsonResponse,
  errorEnvelope,
  okEnvelope,
  nowIso,
  APP_VERSION,
  HUB_DB_PATH,
  safeNextcloudConfig,
  jwtVerifier,
  pathMatch,
  userRoutes,
  chatRoutes,
  taskRoutes,
  searchRoutes,
  reminderRoutes,
  spaceRoutes,
  projectRoutes,
  docRoutes,
  collectionRoutes,
  recordRoutes,
  viewRoutes,
  notificationRoutes,
  widgetPickerSeedDataRoutes,
  fileRoutes,
  automationRoutes,
  publicRoutes,
}) => async (request, response) => {
  applyRequestContext(request, response);

  if (!request.url) {
    request.log.error('Missing request URL.');
    send(response, jsonResponse(400, errorEnvelope('bad_request', 'Missing request URL.')));
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url, 'http://localhost');
  } catch (error) {
    request.log.warn('Failed to parse request URL.', { url: request.url, error });
    send(response, jsonResponse(400, errorEnvelope('bad_request', 'Malformed request URL.')));
    return;
  }
  const pathname = requestUrl.pathname;

  const publicBugScreenshotMatch = pathMatch(pathname, /^\/public\/bug-report-screenshots\/([^/]+)$/);

  if (request.method === 'OPTIONS' && (pathname === '/public/bug-reports' || pathname === '/public/bugs' || publicBugScreenshotMatch)) {
    await publicRoutes.optionsPublic({ request, response, requestUrl, pathname });
    return;
  }

  if (request.method === 'OPTIONS') {
    send(response, jsonResponse(204, okEnvelope(null)));
    return;
  }

  try {
    if (request.method === 'POST' && pathname === '/public/bug-reports') {
      await publicRoutes.submitBugReport({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/public/bugs') {
      await publicRoutes.listPublicBugs({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && publicBugScreenshotMatch) {
      await publicRoutes.serveBugReportScreenshot({
        request,
        response,
        requestUrl,
        pathname,
        params: { fileName: decodeURIComponent(publicBugScreenshotMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      send(
        response,
        jsonResponse(200, {
          status: 'ok',
          timestamp: nowIso(),
          uptime: process.uptime(),
          version: APP_VERSION,
        }),
      );
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/health') {
      send(
        response,
        jsonResponse(
          200,
          okEnvelope({
            schema_version: 3,
            db_path: HUB_DB_PATH,
            nextcloud_configured: safeNextcloudConfig(),
            issuer: jwtVerifier.issuer,
            audience: jwtVerifier.expectedAudiences,
            jwks_url: jwtVerifier.jwksUrl,
          }),
        ),
      );
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/me') {
      await userRoutes.getSession({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/dev/bootstrap-auth') {
      await userRoutes.getLocalDevBootstrapAuth({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/chat/provision') {
      await chatRoutes.provision({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/chat/snapshots' && request.method === 'POST') {
      await chatRoutes.createSnapshot({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/chat/snapshots' && request.method === 'GET') {
      await chatRoutes.listSnapshots({ request, response, requestUrl, pathname });
      return;
    }

    const chatSnapshotItemMatch = pathMatch(pathname, /^\/api\/hub\/chat\/snapshots\/([^/]+)$/);
    if (chatSnapshotItemMatch && request.method === 'DELETE') {
      await chatRoutes.deleteSnapshot({
        request,
        response,
        requestUrl,
        pathname,
        params: { snapshotId: decodeURIComponent(chatSnapshotItemMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/home') {
      await taskRoutes.getHubHome({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/search') {
      await searchRoutes.globalSearch({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/widget-picker/seed-data') {
      await widgetPickerSeedDataRoutes.listSeedData({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/tasks' && request.method === 'GET') {
      await taskRoutes.getHubTasks({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/tasks' && request.method === 'POST') {
      await taskRoutes.createHubTask({ request, response, requestUrl, pathname });
      return;
    }

    if (pathname === '/api/hub/reminders' && request.method === 'GET') {
      await reminderRoutes.listReminders({ request, response, requestUrl, pathname, params: {} });
      return;
    }

    if (pathname === '/api/hub/reminders' && request.method === 'POST') {
      await reminderRoutes.createReminder({ request, response, requestUrl, pathname, params: {} });
      return;
    }

    const reminderDismissMatch = pathMatch(pathname, /^\/api\/hub\/reminders\/([^/]+)\/dismiss$/);
    if (reminderDismissMatch && request.method === 'POST') {
      await reminderRoutes.dismissReminder({
        request,
        response,
        requestUrl,
        pathname,
        params: { reminderId: decodeURIComponent(reminderDismissMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/spaces') {
      await spaceRoutes.listProjects({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/spaces') {
      await spaceRoutes.createProject({ request, response, requestUrl, pathname });
      return;
    }

    const projectItemMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)$/);
    if (request.method === 'GET' && projectItemMatch) {
      await spaceRoutes.getProject({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectItemMatch[1]) },
      });
      return;
    }

    if (request.method === 'PATCH' && projectItemMatch) {
      await spaceRoutes.updateProject({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectItemMatch[1]) },
      });
      return;
    }

    if (request.method === 'DELETE' && projectItemMatch) {
      await spaceRoutes.deleteProject({
        request,
        response,
        requestUrl,
        pathname,
        params: { spaceId: decodeURIComponent(projectItemMatch[1]) },
      });
      return;
    }

    const projectMembersMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/members$/);
    if (projectMembersMatch && request.method === 'GET') {
      await spaceRoutes.listProjectMembers({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectMembersMatch[1]) },
      });
      return;
    }

    if (projectMembersMatch && request.method === 'POST') {
      await spaceRoutes.addProjectMember({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectMembersMatch[1]) },
      });
      return;
    }

    const projectInvitesMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/invites$/);
    if (projectInvitesMatch && request.method === 'POST') {
      await spaceRoutes.createInvite({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectInvitesMatch[1]) },
      });
      return;
    }

    const projectInviteItemMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/invites\/([^/]+)$/);
    if (projectInviteItemMatch && request.method === 'POST') {
      await spaceRoutes.reviewInvite({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          projectId: decodeURIComponent(projectInviteItemMatch[1]),
          inviteRequestId: decodeURIComponent(projectInviteItemMatch[2]),
        },
      });
      return;
    }

    const projectMemberItemMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/members\/([^/]+)$/);
    if (projectMemberItemMatch && request.method === 'DELETE') {
      await spaceRoutes.removeProjectMember({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          projectId: decodeURIComponent(projectMemberItemMatch[1]),
          targetUserId: decodeURIComponent(projectMemberItemMatch[2]),
        },
      });
      return;
    }

    const projectProjectsMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/projects$/);
    if (projectProjectsMatch && request.method === 'GET') {
      await projectRoutes.listProjectProjects({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectProjectsMatch[1]) },
      });
      return;
    }

    if (projectProjectsMatch && request.method === 'POST') {
      await projectRoutes.createProjectProject({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectProjectsMatch[1]) },
      });
      return;
    }

    const projectTasksMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/tasks$/);
    if (projectTasksMatch && request.method === 'GET') {
      await taskRoutes.listProjectTasks({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectTasksMatch[1]) },
      });
      return;
    }

    const workProjectItemMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)$/);
    if (workProjectItemMatch && request.method === 'PATCH') {
      await projectRoutes.updateProject({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(workProjectItemMatch[1]) },
      });
      return;
    }

    if (workProjectItemMatch && request.method === 'DELETE') {
      await projectRoutes.deleteProject({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(workProjectItemMatch[1]) },
      });
      return;
    }

    const workProjectDocsMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/docs$/);
    if (workProjectDocsMatch && request.method === 'POST') {
      await docRoutes.createProjectDoc({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(workProjectDocsMatch[1]) },
      });
      return;
    }

    const workProjectMembersMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/members$/);
    if (workProjectMembersMatch && request.method === 'POST') {
      await projectRoutes.addProjectMember({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(workProjectMembersMatch[1]) },
      });
      return;
    }

    const workProjectMemberItemMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/members\/([^/]+)$/);
    if (workProjectMemberItemMatch && request.method === 'DELETE') {
      await projectRoutes.removeProjectMember({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          projectId: decodeURIComponent(workProjectMemberItemMatch[1]),
          userId: decodeURIComponent(workProjectMemberItemMatch[2]),
        },
      });
      return;
    }

    const docItemMatch = pathMatch(pathname, /^\/api\/hub\/docs\/([^/]+)$/);
    if (docItemMatch && request.method === 'GET') {
      await docRoutes.getDoc({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docItemMatch[1]) },
      });
      return;
    }

    if (docItemMatch && request.method === 'PUT') {
      await docRoutes.updateDoc({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docItemMatch[1]) },
      });
      return;
    }

    if (docItemMatch && request.method === 'PATCH') {
      await docRoutes.updateDocMeta({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docItemMatch[1]) },
      });
      return;
    }

    if (docItemMatch && request.method === 'DELETE') {
      await docRoutes.deleteDoc({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docItemMatch[1]) },
      });
      return;
    }

    const docPresenceMatch = pathMatch(pathname, /^\/api\/hub\/docs\/([^/]+)\/presence$/);
    if (docPresenceMatch && request.method === 'POST') {
      await docRoutes.updateDocPresence({
        request,
        response,
        requestUrl,
        pathname,
        params: { docId: decodeURIComponent(docPresenceMatch[1]) },
      });
      return;
    }

    const collectionsByProjectMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/collections$/);
    if (collectionsByProjectMatch && request.method === 'GET') {
      await collectionRoutes.listCollections({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(collectionsByProjectMatch[1]) },
      });
      return;
    }

    if (collectionsByProjectMatch && request.method === 'POST') {
      await collectionRoutes.createCollection({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(collectionsByProjectMatch[1]) },
      });
      return;
    }

    const collectionFieldsMatch = pathMatch(pathname, /^\/api\/hub\/collections\/([^/]+)\/fields$/);
    if (collectionFieldsMatch && request.method === 'GET') {
      await collectionRoutes.listCollectionFields({
        request,
        response,
        requestUrl,
        pathname,
        params: { collectionId: decodeURIComponent(collectionFieldsMatch[1]) },
      });
      return;
    }

    if (collectionFieldsMatch && request.method === 'POST') {
      await collectionRoutes.createCollectionField({
        request,
        response,
        requestUrl,
        pathname,
        params: { collectionId: decodeURIComponent(collectionFieldsMatch[1]) },
      });
      return;
    }

    const projectRecordsMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/records$/);
    if (projectRecordsMatch && request.method === 'POST') {
      await recordRoutes.createRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectRecordsMatch[1]) },
      });
      return;
    }

    const projectRecordSearchMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/records\/search$/);
    if (projectRecordSearchMatch && request.method === 'GET') {
      await recordRoutes.searchProjectRecords({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectRecordSearchMatch[1]) },
      });
      return;
    }

    const recordConvertMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/convert$/);
    if (recordConvertMatch && request.method === 'POST') {
      await recordRoutes.convertRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordConvertMatch[1]) },
      });
      return;
    }

    const recordSubtasksMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/subtasks$/);
    if (recordSubtasksMatch && request.method === 'GET') {
      await recordRoutes.listSubtasks({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordSubtasksMatch[1]) },
      });
      return;
    }

    const recordItemMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)$/);
    if (recordItemMatch && request.method === 'PATCH') {
      await recordRoutes.updateRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordItemMatch[1]) },
      });
      return;
    }

    if (recordItemMatch && request.method === 'GET') {
      await recordRoutes.getRecord({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordItemMatch[1]) },
      });
      return;
    }

    const recordValuesMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/values$/);
    if (recordValuesMatch && request.method === 'POST') {
      await recordRoutes.updateRecordValues({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordValuesMatch[1]) },
      });
      return;
    }

    const recordRelationsMatch = pathMatch(pathname, /^\/api\/hub\/records\/([^/]+)\/relations$/);
    if (recordRelationsMatch && request.method === 'POST') {
      await recordRoutes.createRecordRelation({
        request,
        response,
        requestUrl,
        pathname,
        params: { recordId: decodeURIComponent(recordRelationsMatch[1]) },
      });
      return;
    }

    const relationItemMatch = pathMatch(pathname, /^\/api\/hub\/relations\/([^/]+)$/);
    if (relationItemMatch && request.method === 'DELETE') {
      await recordRoutes.deleteRelation({
        request,
        response,
        requestUrl,
        pathname,
        params: { relationId: decodeURIComponent(relationItemMatch[1]) },
      });
      return;
    }

    const projectMentionSearchMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/mentions\/search$/);
    if (projectMentionSearchMatch && request.method === 'GET') {
      await collectionRoutes.searchMentions({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectMentionSearchMatch[1]) },
      });
      return;
    }

    const projectBacklinksMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/backlinks$/);
    if (projectBacklinksMatch && request.method === 'GET') {
      await collectionRoutes.listBacklinks({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectBacklinksMatch[1]) },
      });
      return;
    }

    const projectViewsMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/views$/);
    if (projectViewsMatch && request.method === 'GET') {
      await viewRoutes.listViews({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectViewsMatch[1]) },
      });
      return;
    }

    if (projectViewsMatch && request.method === 'POST') {
      await viewRoutes.createView({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectViewsMatch[1]) },
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/views/query') {
      await viewRoutes.queryView({ request, response, requestUrl, pathname });
      return;
    }

    const viewItemMatch = pathMatch(pathname, /^\/api\/hub\/views\/([^/]+)$/);
    if (viewItemMatch && request.method === 'PATCH') {
      await viewRoutes.updateView({
        request,
        response,
        requestUrl,
        pathname,
        params: { viewId: decodeURIComponent(viewItemMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/calendar') {
      await viewRoutes.listPersonalCalendar({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/calendar.ics') {
      await viewRoutes.getCalendarFeed({ request, response, requestUrl, pathname });
      return;
    }

    const eventFromNlpMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/events\/from-nlp$/);
    if (eventFromNlpMatch && request.method === 'POST') {
      await viewRoutes.createEventFromNlp({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(eventFromNlpMatch[1]) },
      });
      return;
    }

    const projectCalendarMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/calendar$/);
    if (projectCalendarMatch && request.method === 'GET') {
      await viewRoutes.listProjectCalendar({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectCalendarMatch[1]) },
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/comments') {
      await docRoutes.createComment({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/comments/doc-anchor') {
      await docRoutes.createDocAnchorComment({ request, response, requestUrl, pathname });
      return;
    }

    const commentStatusMatch = pathMatch(pathname, /^\/api\/hub\/comments\/([^/]+)\/status$/);
    if (commentStatusMatch && request.method === 'POST') {
      await docRoutes.updateCommentStatus({
        request,
        response,
        requestUrl,
        pathname,
        params: { commentId: decodeURIComponent(commentStatusMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/comments') {
      await docRoutes.listComments({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/mentions/materialize') {
      await docRoutes.materializeCommentMentions({ request, response, requestUrl, pathname });
      return;
    }

    const projectTimelineMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/timeline$/);
    if (projectTimelineMatch && request.method === 'GET') {
      await viewRoutes.listProjectTimeline({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectTimelineMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/notifications') {
      await notificationRoutes.listNotifications({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/live/authorize') {
      await notificationRoutes.authorizeHubLive({ request, response, requestUrl, pathname });
      return;
    }

    const notificationReadMatch = pathMatch(pathname, /^\/api\/hub\/notifications\/([^/]+)\/read$/);
    if (notificationReadMatch && request.method === 'POST') {
      await notificationRoutes.markNotificationRead({
        request,
        response,
        requestUrl,
        pathname,
        params: {
          notificationId: decodeURIComponent(notificationReadMatch[1]),
        },
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/files/upload') {
      await fileRoutes.uploadFile({ request, response, requestUrl, pathname });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/hub/attachments') {
      await fileRoutes.createAttachment({ request, response, requestUrl, pathname });
      return;
    }

    const attachmentItemMatch = pathMatch(pathname, /^\/api\/hub\/attachments\/([^/]+)$/);
    if (attachmentItemMatch && request.method === 'DELETE') {
      await fileRoutes.deleteAttachment({
        request,
        response,
        requestUrl,
        pathname,
        params: { attachmentId: decodeURIComponent(attachmentItemMatch[1]) },
      });
      return;
    }

    const projectAssetRootsMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/asset-roots$/);
    if (projectAssetRootsMatch && request.method === 'GET') {
      await fileRoutes.listAssetRoots({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetRootsMatch[1]) },
      });
      return;
    }

    if (projectAssetRootsMatch && request.method === 'POST') {
      await fileRoutes.createAssetRoot({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetRootsMatch[1]) },
      });
      return;
    }

    const projectFilesMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/files$/);
    if (projectFilesMatch && request.method === 'GET') {
      await fileRoutes.listProjectFiles({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectFilesMatch[1]) },
      });
      return;
    }

    const projectAssetsListMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/assets\/list$/);
    if (projectAssetsListMatch && request.method === 'GET') {
      await fileRoutes.listAssets({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsListMatch[1]) },
      });
      return;
    }

    const projectAssetsUploadMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/assets\/upload$/);
    if (projectAssetsUploadMatch && request.method === 'POST') {
      await fileRoutes.uploadAsset({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsUploadMatch[1]) },
      });
      return;
    }

    const projectAssetsDeleteMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/assets\/delete$/);
    if (projectAssetsDeleteMatch && request.method === 'DELETE') {
      await fileRoutes.deleteAsset({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsDeleteMatch[1]) },
      });
      return;
    }

    const projectAssetsProxyMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/assets\/proxy$/);
    if (projectAssetsProxyMatch && request.method === 'GET') {
      await fileRoutes.proxyAsset({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAssetsProxyMatch[1]) },
      });
      return;
    }

    const projectAutomationRulesMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/automation-rules$/);
    if (projectAutomationRulesMatch && request.method === 'GET') {
      await automationRoutes.listProjectAutomationRules({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAutomationRulesMatch[1]) },
      });
      return;
    }

    if (projectAutomationRulesMatch && request.method === 'POST') {
      await automationRoutes.createAutomationRule({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAutomationRulesMatch[1]) },
      });
      return;
    }

    const automationRuleItemMatch = pathMatch(pathname, /^\/api\/hub\/automation-rules\/([^/]+)$/);
    if (automationRuleItemMatch && request.method === 'PATCH') {
      await automationRoutes.updateAutomationRule({
        request,
        response,
        requestUrl,
        pathname,
        params: { ruleId: decodeURIComponent(automationRuleItemMatch[1]) },
      });
      return;
    }

    if (automationRuleItemMatch && request.method === 'DELETE') {
      await automationRoutes.deleteAutomationRule({
        request,
        response,
        requestUrl,
        pathname,
        params: { ruleId: decodeURIComponent(automationRuleItemMatch[1]) },
      });
      return;
    }

    const projectAutomationRunsMatch = pathMatch(pathname, /^\/api\/hub\/spaces\/([^/]+)\/automation-runs$/);
    if (projectAutomationRunsMatch && request.method === 'GET') {
      await automationRoutes.listAutomationRuns({
        request,
        response,
        requestUrl,
        pathname,
        params: { projectId: decodeURIComponent(projectAutomationRunsMatch[1]) },
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/hub/collab/authorize') {
      await docRoutes.authorizeCollab({ request, response, requestUrl, pathname });
      return;
    }

    send(response, jsonResponse(404, errorEnvelope('not_found', 'Endpoint not found.')));
  } catch (error) {
    if (error instanceof URIError) {
      request.log.warn('Malformed URL-encoded path parameter.', { error });
      send(response, jsonResponse(400, errorEnvelope('bad_request', 'Malformed URL-encoded path parameter.')));
      return;
    }
    request.log.error('Unhandled request error.', { error });
    send(
      response,
      jsonResponse(500, errorEnvelope('internal_error', 'Internal server error.')),
    );
  }
};
