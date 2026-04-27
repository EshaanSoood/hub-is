import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { recordRecentProjectContribution } from '../features/recentPlaces/store';
import {
  createAssetRoot,
  listAssetRoots,
  listTrackedFiles,
  uploadFile,
} from '../services/hub/files';
import type { HubTrackedFile } from '../services/hub/types';
import { toBase64 } from '../lib/utils';
import type { FilesWidgetItem } from '../components/project-space/FilesWidgetSkin';

const formatFileSize = (sizeBytes: number): string => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
};

const fileExt = (name: string): string => {
  const parts = name.split('.');
  if (parts.length < 2) {
    return '';
  }
  return parts[parts.length - 1]?.toLowerCase() || '';
};

const slugifyPathSegment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'project';

const trackedFileToWidgetItem = (file: HubTrackedFile): FilesWidgetItem => {
  const uploadedAtTimestamp = Number(new Date(file.created_at));
  return {
    id: file.file_id,
    name: file.name,
    ext: fileExt(file.name),
    sizeLabel: formatFileSize(file.size_bytes),
    uploadedAt: new Date(file.created_at).toLocaleString(),
    uploadedAtTimestamp: Number.isFinite(uploadedAtTimestamp) ? uploadedAtTimestamp : undefined,
    openUrl: file.proxy_url,
    thumbnailUrl: file.proxy_url,
    sizeBytes: file.size_bytes,
  };
};

interface AssetRootSummary {
  asset_root_id: string;
  space_id: string;
  provider: string;
  root_path: string;
  connection_ref: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface ActiveProjectSummary {
  project_id?: string;
  name: string;
}

interface UseProjectFilesRuntimeParams {
  accessToken: string;
  projectId: string;
  projectName: string;
  activeProject: ActiveProjectSummary | null;
  onError: (message: string) => void;
}

export const useProjectFilesRuntime = ({
  accessToken,
  projectId,
  projectName,
  activeProject,
  onError,
}: UseProjectFilesRuntimeParams) => {
  const [assetRoots, setAssetRoots] = useState<AssetRootSummary[]>([]);
  const [pendingProjectFiles, setPendingProjectFiles] = useState<FilesWidgetItem[]>([]);
  const [trackedProjectFiles, setTrackedProjectFiles] = useState<FilesWidgetItem[]>([]);
  const [pendingProjectFilesByProjectId, setPendingProjectFilesByProjectId] = useState<Record<string, FilesWidgetItem[]>>({});
  const [trackedProjectFilesByProjectId, setTrackedProjectFilesByProjectId] = useState<Record<string, FilesWidgetItem[]>>({});
  const activeProjectId = activeProject?.project_id ?? null;

  const fileUploadTimersRef = useRef<Record<string, number>>({});
  const fileRemovalTimersRef = useRef<Record<string, number>>({});
  const pendingAssetRootRef = useRef<Promise<string> | null>(null);

  const refreshAssetRoots = useCallback(async () => {
    const roots = await listAssetRoots(accessToken, projectId);
    setAssetRoots(roots);
  }, [accessToken, projectId]);

  const ensureProjectAssetRoot = useCallback(async () => {
    const existing = assetRoots[0];
    if (existing) {
      return existing.asset_root_id;
    }

    if (pendingAssetRootRef.current) {
      return pendingAssetRootRef.current;
    }

    pendingAssetRootRef.current = (async () => {
      const refreshedRoots = await listAssetRoots(accessToken, projectId);
      if (refreshedRoots[0]) {
        setAssetRoots(refreshedRoots);
        return refreshedRoots[0].asset_root_id;
      }

      const created = await createAssetRoot(accessToken, projectId, {
        root_path: `/Projects/${slugifyPathSegment(projectName)}-${projectId.slice(-6)}`,
      });
      const nextRoots = await listAssetRoots(accessToken, projectId);
      setAssetRoots(nextRoots);
      return nextRoots[0]?.asset_root_id || created.asset_root_id;
    })();

    try {
      return await pendingAssetRootRef.current;
    } finally {
      pendingAssetRootRef.current = null;
    }
  }, [accessToken, assetRoots, projectId, projectName]);

  const refreshTrackedSpaceFiles = useCallback(async () => {
    const files = await listTrackedFiles(accessToken, projectId, { scope: 'space' });
    setTrackedProjectFiles(files.map(trackedFileToWidgetItem));
  }, [accessToken, projectId]);

  const refreshTrackedProjectFiles = useCallback(
    async (projectIdToLoad: string) => {
      const files = await listTrackedFiles(accessToken, projectId, {
        scope: 'project',
        project_id: projectIdToLoad,
      });
      setTrackedProjectFilesByProjectId((current) => ({
        ...current,
        [projectIdToLoad]: files.map(trackedFileToWidgetItem),
      }));
    },
    [accessToken, projectId],
  );

  useEffect(() => {
    void refreshAssetRoots();
  }, [refreshAssetRoots]);

  useEffect(() => {
    void refreshTrackedSpaceFiles();
  }, [refreshTrackedSpaceFiles]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }
    void refreshTrackedProjectFiles(activeProjectId);
  }, [activeProjectId, refreshTrackedProjectFiles]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(fileUploadTimersRef.current)) {
        window.clearInterval(timer);
      }
      fileUploadTimersRef.current = {};
      for (const timer of Object.values(fileRemovalTimersRef.current)) {
        window.clearTimeout(timer);
      }
      fileRemovalTimersRef.current = {};
    };
  }, []);

  const updatePendingProjectFile = useCallback(
    (projectIdToUpdate: string, fileId: string, mapFn: (current: FilesWidgetItem) => FilesWidgetItem) => {
      setPendingProjectFilesByProjectId((current) => {
        const currentFiles = current[projectIdToUpdate] ?? [];
        const nextProjectFiles = currentFiles.map((item) => (item.id === fileId ? mapFn(item) : item));
        return {
          ...current,
          [projectIdToUpdate]: nextProjectFiles,
        };
      });
    },
    [],
  );

  const updatePendingSpaceFile = useCallback((fileId: string, mapFn: (current: FilesWidgetItem) => FilesWidgetItem) => {
    setPendingProjectFiles((current) => current.map((item) => (item.id === fileId ? mapFn(item) : item)));
  }, []);

  const removePendingProjectFile = useCallback((projectIdToUpdate: string, fileId: string) => {
    setPendingProjectFilesByProjectId((current) => ({
      ...current,
      [projectIdToUpdate]: (current[projectIdToUpdate] ?? []).filter((item) => item.id !== fileId),
    }));
  }, []);

  const removePendingSpaceFile = useCallback((fileId: string) => {
    setPendingProjectFiles((current) => current.filter((item) => item.id !== fileId));
  }, []);

  const onUploadSpaceFiles = useCallback(
    (nextFiles: File[]) => {
      if (nextFiles.length === 0) {
        return;
      }

      const startedAt = new Date().toLocaleString();
      const startedAtTimestamp = Date.now();
      const queued = nextFiles.map((file) => ({
        localFile: file,
        item: {
          id: `project-file-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          name: file.name,
          ext: fileExt(file.name),
          sizeLabel: formatFileSize(file.size),
          uploadedAt: startedAt,
          uploadedAtTimestamp: startedAtTimestamp,
          uploadProgress: 1,
          sizeBytes: file.size,
        } satisfies FilesWidgetItem,
      }));

      setPendingProjectFiles((current) => [...queued.map((entry) => entry.item), ...current]);

      for (const entry of queued) {
        const timer = window.setInterval(() => {
          updatePendingSpaceFile(entry.item.id, (current) => {
            if (current.uploadProgress === undefined || current.uploadProgress >= 90) {
              return current;
            }
            return {
              ...current,
              uploadProgress: Math.min(90, current.uploadProgress + 4 + Math.floor(Math.random() * 8)),
            };
          });
        }, 180);
        fileUploadTimersRef.current[entry.item.id] = timer;

        void (async () => {
          try {
            const [base64, assetRootId] = await Promise.all([toBase64(entry.localFile), ensureProjectAssetRoot()]);
            const uploaded = await uploadFile(accessToken, {
              space_id: projectId,
              asset_root_id: assetRootId,
              name: entry.localFile.name,
              mime_type: entry.localFile.type || 'application/octet-stream',
              content_base64: base64,
              path: 'Space Files',
              mutation_context_project_id: activeProjectId || undefined,
              metadata: {
                scope: 'space',
              },
            });

            updatePendingSpaceFile(entry.item.id, (current) => ({
              ...current,
              uploadProgress: 100,
              uploadedAt: new Date().toLocaleString(),
              uploadedAtTimestamp: Date.now(),
              sizeLabel: formatFileSize(uploaded.file.size_bytes),
              sizeBytes: uploaded.file.size_bytes,
              openUrl: uploaded.file.proxy_url,
              thumbnailUrl: uploaded.file.proxy_url,
            }));

            await refreshTrackedSpaceFiles();
            if (activeProject && activeProjectId) {
              recordRecentProjectContribution({
                projectId: activeProjectId,
                projectName: activeProject.name,
                spaceId: projectId,
                spaceName: projectName,
              }, 'file-upload');
            }
            const removalTimer = window.setTimeout(() => {
              removePendingSpaceFile(entry.item.id);
              delete fileRemovalTimersRef.current[entry.item.id];
            }, 450);
            fileRemovalTimersRef.current[entry.item.id] = removalTimer;
          } catch (error) {
            updatePendingSpaceFile(entry.item.id, (current) => ({
              ...current,
              uploadProgress: undefined,
              uploadedAt: 'Upload failed',
              uploadedAtTimestamp: current.uploadedAtTimestamp ?? Date.now(),
            }));
            onError(error instanceof Error ? error.message : 'File upload failed.');
          } finally {
            const trackedTimer = fileUploadTimersRef.current[entry.item.id];
            if (trackedTimer) {
              window.clearInterval(trackedTimer);
              delete fileUploadTimersRef.current[entry.item.id];
            }
          }
        })();
      }
    },
    [
      accessToken,
      activeProject,
      activeProjectId,
      ensureProjectAssetRoot,
      onError,
      projectId,
      projectName,
      refreshTrackedSpaceFiles,
      removePendingSpaceFile,
      updatePendingSpaceFile,
    ],
  );

  const onUploadProjectFiles = useCallback(
    (nextFiles: File[]) => {
      if (!activeProject || !activeProjectId || nextFiles.length === 0) {
        return;
      }

      const projectIdForUpload = activeProjectId;
      const projectPath = `Project Files/${projectIdForUpload}`;
      const startedAt = new Date().toLocaleString();
      const startedAtTimestamp = Date.now();
      const queued = nextFiles.map((file) => ({
        localFile: file,
        item: {
          id: `project-file-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          name: file.name,
          ext: fileExt(file.name),
          sizeLabel: formatFileSize(file.size),
          uploadedAt: startedAt,
          uploadedAtTimestamp: startedAtTimestamp,
          uploadProgress: 1,
          sizeBytes: file.size,
        } satisfies FilesWidgetItem,
      }));

      setPendingProjectFilesByProjectId((current) => ({
        ...current,
        [projectIdForUpload]: [...queued.map((entry) => entry.item), ...(current[projectIdForUpload] ?? [])],
      }));

      for (const entry of queued) {
        const timer = window.setInterval(() => {
          updatePendingProjectFile(projectIdForUpload, entry.item.id, (current) => {
            if (current.uploadProgress === undefined || current.uploadProgress >= 90) {
              return current;
            }
            return {
              ...current,
              uploadProgress: Math.min(90, current.uploadProgress + 4 + Math.floor(Math.random() * 8)),
            };
          });
        }, 180);
        fileUploadTimersRef.current[entry.item.id] = timer;

        void (async () => {
          try {
            const [base64, assetRootId] = await Promise.all([toBase64(entry.localFile), ensureProjectAssetRoot()]);
            const uploaded = await uploadFile(accessToken, {
              space_id: projectId,
              asset_root_id: assetRootId,
              name: entry.localFile.name,
              mime_type: entry.localFile.type || 'application/octet-stream',
              content_base64: base64,
              path: projectPath,
              mutation_context_project_id: projectIdForUpload,
              metadata: {
                scope: 'project',
                project_id: projectIdForUpload,
                project_name: activeProject.name,
              },
            });

            updatePendingProjectFile(projectIdForUpload, entry.item.id, (current) => ({
              ...current,
              uploadProgress: 100,
              uploadedAt: new Date().toLocaleString(),
              uploadedAtTimestamp: Date.now(),
              sizeLabel: formatFileSize(uploaded.file.size_bytes),
              sizeBytes: uploaded.file.size_bytes,
              openUrl: uploaded.file.proxy_url,
              thumbnailUrl: uploaded.file.proxy_url,
            }));

            await Promise.all([refreshTrackedSpaceFiles(), refreshTrackedProjectFiles(projectIdForUpload)]);
            recordRecentProjectContribution({
              projectId: projectIdForUpload,
              projectName: activeProject.name,
              spaceId: projectId,
              spaceName: projectName,
            }, 'project-file-upload');
            const removalTimer = window.setTimeout(() => {
              removePendingProjectFile(projectIdForUpload, entry.item.id);
              delete fileRemovalTimersRef.current[entry.item.id];
            }, 450);
            fileRemovalTimersRef.current[entry.item.id] = removalTimer;
          } catch (error) {
            updatePendingProjectFile(projectIdForUpload, entry.item.id, (current) => ({
              ...current,
              uploadProgress: undefined,
              uploadedAt: 'Upload failed',
              uploadedAtTimestamp: current.uploadedAtTimestamp ?? Date.now(),
            }));
            onError(error instanceof Error ? error.message : 'File upload failed.');
          } finally {
            const trackedTimer = fileUploadTimersRef.current[entry.item.id];
            if (trackedTimer) {
              window.clearInterval(trackedTimer);
              delete fileUploadTimersRef.current[entry.item.id];
            }
          }
        })();
      }
    },
    [
      accessToken,
      activeProject,
      activeProjectId,
      ensureProjectAssetRoot,
      onError,
      projectId,
      projectName,
      refreshTrackedSpaceFiles,
      refreshTrackedProjectFiles,
      removePendingProjectFile,
      updatePendingProjectFile,
    ],
  );

  const onOpenProjectFile = useCallback((file: FilesWidgetItem) => {
    if (file.openUrl) {
      window.open(file.openUrl, '_blank', 'noopener');
    }
  }, []);

  const activeProjectFiles = useMemo(() => {
    if (!activeProject) {
      return [];
    }
    if (!activeProjectId) {
      return [];
    }
    const combined = [...(pendingProjectFilesByProjectId[activeProjectId] ?? []), ...(trackedProjectFilesByProjectId[activeProjectId] ?? [])];
    return combined.sort((left, right) => {
      const leftTime = left.uploadedAtTimestamp ?? Number(new Date(left.uploadedAt));
      const rightTime = right.uploadedAtTimestamp ?? Number(new Date(right.uploadedAt));
      const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
      return safeRight - safeLeft;
    });
  }, [activeProject, activeProjectId, pendingProjectFilesByProjectId, trackedProjectFilesByProjectId]);

  const spaceFiles = useMemo(
    () =>
      [...pendingProjectFiles, ...trackedProjectFiles].sort((left, right) => {
        const leftTime = left.uploadedAtTimestamp ?? Number(new Date(left.uploadedAt));
        const rightTime = right.uploadedAtTimestamp ?? Number(new Date(right.uploadedAt));
        const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
        const safeRight = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
        return safeRight - safeLeft;
      }),
    [pendingProjectFiles, trackedProjectFiles],
  );

  return {
    ensureProjectAssetRoot,
    onOpenProjectFile,
    onUploadProjectFiles,
    onUploadSpaceFiles,
    projectFiles: activeProjectFiles,
    spaceFiles,
    refreshTrackedSpaceFiles,
  };
};
