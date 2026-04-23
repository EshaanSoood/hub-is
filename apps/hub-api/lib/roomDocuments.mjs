const ROOM_DOCUMENT_SCOPE_PREFIX = 'room:';

export const isRoomDocumentId = (docId) =>
  typeof docId === 'string' && docId.startsWith(ROOM_DOCUMENT_SCOPE_PREFIX);

export const buildRoomDocumentId = (roomId) => `${ROOM_DOCUMENT_SCOPE_PREFIX}${String(roomId || '').trim()}`;

export const parseRoomIdFromDocumentId = (docId) => {
  if (!isRoomDocumentId(docId)) {
    return '';
  }
  return String(docId).slice(ROOM_DOCUMENT_SCOPE_PREFIX.length).trim();
};
