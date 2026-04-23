import { z } from 'zod';

const RoomIdSchema = z.string().trim().min(1);
const UserIdSchema = z.string().trim().min(1);
const SpaceIdSchema = z.string().trim().min(1);
const RoomDisplayNameSchema = z.string().trim().min(1);
const IsoTimestampSchema = z.string().datetime({ offset: true });

export const RoomStatusSchema = z.enum(['active', 'archived']);

export const RoomSchema = z.object({
  id: RoomIdSchema,
  displayName: RoomDisplayNameSchema,
  spaceId: SpaceIdSchema,
  status: RoomStatusSchema,
  createdAt: IsoTimestampSchema,
  archivedAt: IsoTimestampSchema.nullable(),
  memberUserIds: z.array(UserIdSchema),
});

export const RoomMembershipRoleSchema = z.enum(['owner', 'participant']);

export const RoomMembershipSchema = z.object({
  roomId: RoomIdSchema,
  userId: UserIdSchema,
  role: RoomMembershipRoleSchema,
  joinedAt: IsoTimestampSchema,
});
