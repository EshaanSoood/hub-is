import { createHmac } from 'node:crypto';

export const createCalendarFeedTokenHelpers = ({
  HUB_CALENDAR_FEED_TOKEN_SECRET,
  HUB_PUBLIC_APP_URL,
  asText,
  nowIso,
  db,
  withTransaction,
  calendarFeedTokenByUserIdStmt,
  calendarFeedTokenByTokenStmt,
  insertCalendarFeedTokenStmt,
}) => {
  const CALENDAR_FEED_TOKEN_HASH_PREFIX = 'h1:';

  const calendarFeedTokenSecret = () => {
    if (!HUB_CALENDAR_FEED_TOKEN_SECRET) {
      throw new Error('Calendar feed token secret is unavailable.');
    }
    return HUB_CALENDAR_FEED_TOKEN_SECRET;
  };

  const deriveCalendarFeedToken = (userId) =>
    createHmac('sha256', calendarFeedTokenSecret())
      .update(`calendar-feed:user:${asText(userId)}`)
      .digest('hex');

  const hashCalendarFeedToken = (token) =>
    `${CALENDAR_FEED_TOKEN_HASH_PREFIX}${createHmac('sha256', calendarFeedTokenSecret())
      .update(`calendar-feed:token:${asText(token)}`)
      .digest('hex')}`;

  const getOrCreateCalendarFeedToken = (userId) => {
    const normalizedUserId = asText(userId);
    if (!normalizedUserId) {
      throw new Error('User ID is required to issue a calendar feed token.');
    }

    const token = deriveCalendarFeedToken(normalizedUserId);
    const storedToken = hashCalendarFeedToken(token);
    const existing = calendarFeedTokenByUserIdStmt.get(normalizedUserId);
    if (existing && asText(existing.token) === storedToken) {
      return {
        token,
        user_id: normalizedUserId,
        created_at: existing.created_at,
      };
    }

    return withTransaction(db, () => {
      const current = calendarFeedTokenByUserIdStmt.get(normalizedUserId);
      const createdAt = asText(current?.created_at) || nowIso();
      if (!current || asText(current.token) !== storedToken) {
        insertCalendarFeedTokenStmt.run(storedToken, normalizedUserId, createdAt);
      }
      return {
        token,
        user_id: normalizedUserId,
        created_at: createdAt,
      };
    });
  };

  const buildCalendarFeedUrl = (token) =>
    `${HUB_PUBLIC_APP_URL}/api/hub/calendar.ics?token=${encodeURIComponent(asText(token))}`;

  const findCalendarFeedTokenRecord = (token) => {
    const normalizedToken = asText(token);
    if (!normalizedToken) {
      return null;
    }
    return calendarFeedTokenByTokenStmt.get(hashCalendarFeedToken(normalizedToken)) || null;
  };

  return {
    getOrCreateCalendarFeedToken,
    buildCalendarFeedUrl,
    findCalendarFeedTokenRecord,
  };
};
