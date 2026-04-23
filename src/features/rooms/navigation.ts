import { z } from 'zod';

const RoomParamSchema = z.string().trim().min(1);

const parseRoomParam = (value: string | undefined): string => {
  const result = RoomParamSchema.safeParse(value);
  return result.success ? result.data : '';
};

export const parseRoomIdParam = parseRoomParam;
export const parseRoomProjectPaneIdParam = parseRoomParam;

export const buildRoomHref = (roomId: string): string =>
  `/rooms/${encodeURIComponent(roomId)}`;

export const buildRoomProjectHref = (roomId: string, paneId: string): string =>
  `/rooms/${encodeURIComponent(roomId)}/projects/${encodeURIComponent(paneId)}`;
