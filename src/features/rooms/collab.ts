export const ROOM_DOCUMENT_SCOPE_PREFIX = 'room:';

const normalizeRoomId = (roomId: string): string => roomId.trim();

export const parseRoomIdFromDocumentId = (docId: string): string | null => {
  if (!docId.startsWith(ROOM_DOCUMENT_SCOPE_PREFIX)) {
    return null;
  }

  const roomId = normalizeRoomId(docId.slice(ROOM_DOCUMENT_SCOPE_PREFIX.length));
  return roomId.length > 0 ? roomId : null;
};

export const isRoomDocumentId = (docId: string): boolean =>
  parseRoomIdFromDocumentId(docId) !== null;

export const buildRoomDocumentId = (roomId: string): string => {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    throw new Error('buildRoomDocumentId requires a non-empty roomId');
  }
  return `${ROOM_DOCUMENT_SCOPE_PREFIX}${normalizedRoomId}`;
};
