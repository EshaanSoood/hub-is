export const ROOM_DOCUMENT_SCOPE_PREFIX = 'room:';

export const buildRoomDocumentId = (roomId: string): string =>
  `${ROOM_DOCUMENT_SCOPE_PREFIX}${roomId.trim()}`;

export const isRoomDocumentId = (docId: string): boolean =>
  docId.startsWith(ROOM_DOCUMENT_SCOPE_PREFIX);

export const parseRoomIdFromDocumentId = (docId: string): string | null => {
  if (!isRoomDocumentId(docId)) {
    return null;
  }

  const roomId = docId.slice(ROOM_DOCUMENT_SCOPE_PREFIX.length).trim();
  return roomId.length > 0 ? roomId : null;
};
