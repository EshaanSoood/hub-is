export type { Room, RoomMembership } from '../../features/rooms/types';

import type { Room, RoomMembership } from '../../features/rooms/types';

export interface ListRoomsResponse {
  rooms: Room[];
}

export interface GetRoomResponse {
  room: Room;
}

export interface CreateRoomRequest {
  displayName: string;
  spaceId: string;
  projectNames: [string, string];
  participantIdentifiers: string[];
}

export interface CreateRoomResponse {
  room: Room;
}

export interface ArchiveRoomResponse {
  room: Room;
}

export interface ListRoomMembersResponse {
  members: RoomMembership[];
}

export interface AddRoomMemberRequest {
  email: string;
  display_name?: string;
}

export interface AddRoomMemberResponse {
  members: RoomMembership[];
}

export interface RoomProjectMigrationRequest {
  projectMigrations: Array<{
    sourcePaneId: string;
    destinationName: string;
  }>;
}

export interface RoomProjectMigrationResult {
  sourcePaneId: string;
  sourcePaneName: string;
  targetPaneId: string;
  targetPaneName: string;
  migratedTaskCount: number;
  migratedDocument: boolean;
}

export interface RoomProjectMigrationResponse {
  projectId: string;
  migrations: RoomProjectMigrationResult[];
}
