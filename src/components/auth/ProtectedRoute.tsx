import type { ReactNode } from 'react';
import { useAuthz } from '../../context/AuthzContext';
import type { GlobalCapability } from '../../types/domain';
import { AccessDeniedView } from './AccessDeniedView';

export const ProtectedRoute = ({
  capability,
  children,
}: {
  capability: GlobalCapability;
  children: ReactNode;
}) => {
  const { signedIn, canGlobal } = useAuthz();

  if (!signedIn) {
    return <AccessDeniedView message="Sign in is required to access this route." />;
  }

  if (!canGlobal(capability)) {
    return <AccessDeniedView message={`Missing required capability: ${capability}`} />;
  }

  return <>{children}</>;
};
