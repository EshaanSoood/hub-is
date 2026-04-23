const ROOM_DOCUMENT_SCOPE_PREFIX = 'room:';

const normalizeRoomId = (roomId) => String(roomId ?? '').trim();

export const parseRoomIdFromDocumentId = (docId) => {
  if (typeof docId !== 'string' || !docId.startsWith(ROOM_DOCUMENT_SCOPE_PREFIX)) {
    return '';
  }
  return normalizeRoomId(docId.slice(ROOM_DOCUMENT_SCOPE_PREFIX.length));
};

export const isRoomDocumentId = (docId) =>
  parseRoomIdFromDocumentId(docId) !== '';

export const buildRoomDocumentId = (roomId) => {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    throw new Error('buildRoomDocumentId requires a non-empty roomId');
  }
  return `${ROOM_DOCUMENT_SCOPE_PREFIX}${normalizedRoomId}`;
};
