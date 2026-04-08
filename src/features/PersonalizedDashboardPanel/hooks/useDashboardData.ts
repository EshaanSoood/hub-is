import { useMemo } from 'react';
import { useAuthz } from '../../../context/AuthzContext';
import { useRemindersRuntime } from '../../../hooks/useRemindersRuntime';
import { dashboardCardRegistry } from '../../../lib/dashboardCards';
import type { ProjectRecord } from '../../../types/domain';

export const useDashboardData = (projects: ProjectRecord[]) => {
  const { accessToken, canGlobal, sessionSummary } = useAuthz();
  const remindersRuntime = useRemindersRuntime(accessToken ?? null);

  const visibleDashboardCards = useMemo(
    () =>
      dashboardCardRegistry.filter((card) => {
        const hasGlobalCaps = card.requiredGlobalCapabilities.every((capability) =>
          sessionSummary.globalCapabilities.includes(capability),
        );
        if (!hasGlobalCaps) {
          return false;
        }
        if (!card.requiredProjectCapability) {
          return true;
        }
        const requiredProjectCapability = card.requiredProjectCapability;
        return projects.some((project) =>
          (sessionSummary.projectCapabilities[project.id] ?? []).includes(requiredProjectCapability),
        );
      }),
    [projects, sessionSummary.globalCapabilities, sessionSummary.projectCapabilities],
  );

  const hasHubView =
    canGlobal('hub.view') || visibleDashboardCards.some((card) => card.requiredGlobalCapabilities.includes('hub.view'));

  return {
    accessToken,
    remindersRuntime,
    hasHubView,
  };
};
