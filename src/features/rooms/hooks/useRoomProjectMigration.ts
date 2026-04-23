import { useCallback, useState } from 'react';

import type { RoomProjectMigrationResult } from '../../../shared/api-types';
import { migrateRoomProjects } from '../../../services/hub/rooms';

interface UseRoomProjectMigrationParams {
  accessToken: string | null | undefined;
  roomId: string;
}

export const useRoomProjectMigration = ({
  accessToken,
  roomId,
}: UseRoomProjectMigrationParams) => {
  const [error, setError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState<RoomProjectMigrationResult[] | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setMigrating(false);
    setResults(null);
    setTargetProjectId(null);
  }, []);

  const migrate = useCallback(async (payload: Array<{ sourcePaneId: string; destinationName: string }>) => {
    if (!accessToken) {
      throw new Error('Authentication is required to migrate room content.');
    }

    setMigrating(true);
    setError(null);
    try {
      const response = await migrateRoomProjects(accessToken, roomId, {
        projectMigrations: payload,
      });
      setResults(response.migrations);
      setTargetProjectId(response.projectId);
      return response;
    } catch (migrationError) {
      const message = migrationError instanceof Error ? migrationError.message : 'Failed to migrate room content.';
      setError(message);
      throw migrationError;
    } finally {
      setMigrating(false);
    }
  }, [accessToken, roomId]);

  return {
    error,
    migrate,
    migrating,
    reset,
    results,
    targetProjectId,
  };
};
