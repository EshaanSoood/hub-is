import type { UserIdentity } from '../types/domain';

export const anonymousUser: UserIdentity = {
  id: 'anonymous',
  displayName: 'Signed-out user',
  email: '',
  role: 'viewer',
};
