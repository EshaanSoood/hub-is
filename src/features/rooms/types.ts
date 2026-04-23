import type { z } from 'zod';

import type {
  RoomMembershipRoleSchema,
  RoomMembershipSchema,
  RoomSchema,
  RoomStatusSchema,
} from './schemas';

export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export type Room = z.infer<typeof RoomSchema>;

export type RoomMembershipRole = z.infer<typeof RoomMembershipRoleSchema>;

/**
 * The owner is the space member who created the room.
 */
export type RoomMembership = z.infer<typeof RoomMembershipSchema>;
