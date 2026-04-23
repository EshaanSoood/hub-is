import { z } from 'zod';

const RoomParamSchema = z.string().trim().min(1);

export const parseRoomIdParam = (value: string | undefined): string =>
  RoomParamSchema.safeParse(value).success ? RoomParamSchema.parse(value) : '';

export const parseRoomProjectPaneIdParam = (value: string | undefined): string =>
  RoomParamSchema.safeParse(value).success ? RoomParamSchema.parse(value) : '';

export const buildRoomHref = (roomId: string): string =>
  `/rooms/${encodeURIComponent(roomId)}`;

export const buildRoomProjectHref = (roomId: string, paneId: string): string =>
  `/rooms/${encodeURIComponent(roomId)}/projects/${encodeURIComponent(paneId)}`;
