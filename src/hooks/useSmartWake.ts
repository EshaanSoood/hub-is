import { useSmartWakeContext } from '../context/SmartWakeContext';

export const useSmartWake = () => {
  const { states, wake, cards, sleep, announcement, inactivityWindowMs, workflowInProgress, uploadInProgress } =
    useSmartWakeContext();
  return { states, wake, cards, sleep, announcement, inactivityWindowMs, workflowInProgress, uploadInProgress };
};
