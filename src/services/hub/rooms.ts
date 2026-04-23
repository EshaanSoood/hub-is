import { hubRequest } from './transport.ts';
import type {
  AddRoomMemberRequest,
  AddRoomMemberResponse,
  ArchiveRoomResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomResponse,
  ListRoomMembersResponse,
  ListRoomsResponse,
  Room,
  RoomMembership,
  RoomProjectMigrationRequest,
  RoomProjectMigrationResponse,
  RoomProjectMigrationResult,
} from '../../shared/api-types';

export const listRooms = async (accessToken: string): Promise<Room[]> => {
  const data = await hubRequest<ListRoomsResponse>(accessToken, '/api/hub/rooms', {
    method: 'GET',
  });
  return data.rooms;
};

export const getRoom = async (accessToken: string, roomId: string): Promise<Room> => {
  const data = await hubRequest<GetRoomResponse>(accessToken, `/api/hub/rooms/${encodeURIComponent(roomId)}`, {
    method: 'GET',
  });
  return data.room;
};

export const createRoom = async (
  accessToken: string,
  payload: CreateRoomRequest,
): Promise<Room> => {
  const data = await hubRequest<CreateRoomResponse>(accessToken, '/api/hub/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.room;
};

export const archiveRoom = async (accessToken: string, roomId: string): Promise<Room> => {
  const data = await hubRequest<ArchiveRoomResponse>(accessToken, `/api/hub/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'archived' }),
  });
  return data.room;
};

export const listRoomMembers = async (accessToken: string, roomId: string): Promise<RoomMembership[]> => {
  const data = await hubRequest<ListRoomMembersResponse>(
    accessToken,
    `/api/hub/rooms/${encodeURIComponent(roomId)}/members`,
    {
      method: 'GET',
    },
  );
  return data.members;
};

export const addRoomMember = async (
  accessToken: string,
  roomId: string,
  payload: AddRoomMemberRequest,
): Promise<RoomMembership[]> => {
  const data = await hubRequest<AddRoomMemberResponse>(
    accessToken,
    `/api/hub/rooms/${encodeURIComponent(roomId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return data.members;
};

export const migrateRoomProjects = async (
  accessToken: string,
  roomId: string,
  payload: RoomProjectMigrationRequest,
): Promise<{
  projectId: string;
  migrations: RoomProjectMigrationResult[];
}> => {
  const data = await hubRequest<RoomProjectMigrationResponse>(
    accessToken,
    `/api/hub/rooms/${encodeURIComponent(roomId)}/migrations`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return data;
};
