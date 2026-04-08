import { HUB_POSTMARK_INVITE_TEMPLATE } from '../emails/inviteTemplate.mjs';

export const createPostmarkIntegration = ({
  POSTMARK_SERVER_TOKEN,
  POSTMARK_FROM_EMAIL,
  POSTMARK_MESSAGE_STREAM,
  POSTMARK_API_BASE_URL,
  EXTERNAL_API_TIMEOUT_MS,
  HUB_PUBLIC_APP_URL,
  asText,
  fetchWithTimeout,
  isFetchTimeoutError,
  parseUpstreamJson,
}) => {
  const safePostmarkConfig = () => Boolean(POSTMARK_SERVER_TOKEN && POSTMARK_FROM_EMAIL);

  const escapeHtml = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&#39;');

  const renderHubPilotInviteHtml = ({ appUrl = HUB_PUBLIC_APP_URL, projectName = 'Pilot Party' } = {}) => {
    const resolvedUrl = asText(appUrl) || 'https://eshaansood.org';
    const resolvedProjectName = escapeHtml(asText(projectName) || 'Pilot Party');
    return HUB_POSTMARK_INVITE_TEMPLATE
      .replaceAll('{{APP_URL}}', resolvedUrl)
      .replaceAll('{{PROJECT_NAME}}', resolvedProjectName);
  };

  const renderHubPilotInviteText = ({ appUrl = HUB_PUBLIC_APP_URL, projectName = 'Pilot Party' } = {}) => {
    const resolvedUrl = asText(appUrl) || 'https://eshaansood.org';
    const resolvedProjectName = asText(projectName) || 'Pilot Party';
    return [
      `You're invited to ${resolvedProjectName} on Hub OS.`,
      'Well as you know I\'ve been working on this app pretty crazily for the last month. I think I\'m in a place where it\'s ready to be user tested.',
      `I'm inviting you to a project called ${resolvedProjectName} where my hope is that we can use the app itself to track the user and bug testing to see what features it's missing.`,
      'If you do not already have a Hub OS account, you should also receive a secure account setup email from Keycloak. Complete that first, then return to Hub OS.',
      `Join the pilot: ${resolvedUrl}`,
      'Looking forward to what you discover!',
      'Warmly,',
      'Eshaan',
    ].join('\n\n');
  };

  const sendPostmarkEmail = async ({
    to,
    subject,
    htmlBody,
    textBody,
    tag = '',
    requestLog = null,
  }) => {
    if (!safePostmarkConfig()) {
      return {
        error: {
          status: 503,
          code: 'postmark_unavailable',
          message: 'Postmark runtime credentials are not configured.',
        },
      };
    }

    let upstream;
    try {
      upstream = await fetchWithTimeout(
        new URL('/email', `${POSTMARK_API_BASE_URL}/`),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': POSTMARK_SERVER_TOKEN,
          },
          body: JSON.stringify({
            From: POSTMARK_FROM_EMAIL,
            To: to,
            Subject: subject,
            HtmlBody: htmlBody,
            TextBody: textBody,
            MessageStream: POSTMARK_MESSAGE_STREAM,
            ...(tag ? { Tag: tag } : {}),
          }),
        },
        { timeoutMs: EXTERNAL_API_TIMEOUT_MS },
      );
    } catch (error) {
      requestLog?.error?.('Postmark request failed.', { to, error });
      if (isFetchTimeoutError(error)) {
        return {
          error: {
            status: 504,
            code: 'upstream_timeout',
            message: 'Postmark invite email request timed out.',
          },
        };
      }
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: 'Postmark invite email request failed.',
        },
      };
    }

    const body = await parseUpstreamJson(upstream, requestLog, 'Failed to parse Postmark JSON response.');
    if (!upstream.ok) {
      return {
        error: {
          status: 502,
          code: 'upstream_error',
          message: asText(body?.Message) || `Postmark invite email failed (${upstream.status}).`,
        },
      };
    }

    return { data: body };
  };

  const sendHubInviteEmail = async ({ to, projectName = 'Pilot Party', requestLog = null }) =>
    sendPostmarkEmail({
      to,
      subject: "You're invited to Hub OS",
      htmlBody: renderHubPilotInviteHtml({ appUrl: HUB_PUBLIC_APP_URL, projectName }),
      textBody: renderHubPilotInviteText({ appUrl: HUB_PUBLIC_APP_URL, projectName }),
      tag: 'hub-project-invite',
      requestLog,
    });

  return {
    safePostmarkConfig,
    renderHubPilotInviteHtml,
    renderHubPilotInviteText,
    sendPostmarkEmail,
    sendHubInviteEmail,
  };
};
