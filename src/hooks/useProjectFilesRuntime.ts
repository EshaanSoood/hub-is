import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAssetRoot,
  listAssetRoots,
  listTrackedFiles,
  uploadFile,
} from '../services/hub/files';
import type { HubTrackedFile } from '../services/hub/types';
import { toBase64 } from '../lib/utils';
import type { FilesModuleItem } from '../components/project-space/FilesModuleSkin';

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

const trackedFileToModuleItem = (file: HubTrackedFile): FilesModuleItem => {
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
  project_id: string;
  provider: string;
  root_path: string;
  connection_ref: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface ActivePaneSummary {
  pane_id: string;
  name: string;
}

interface UseProjectFilesRuntimeParams {
  accessToken: string;
  projectId: string;
  projectName: string;
  activePane: ActivePaneSummary | null;
  onError: (message: string) => void;
}

export const useProjectFilesRuntime = ({
  accessToken,
  projectId,
  projectName,
  activePane,
  onError,
}: UseProjectFilesRuntimeParams) => {
  const [assetRoots, setAssetRoots] = useState<AssetRootSummary[]>([]);
  const [pendingProjectFiles, setPendingProjectFiles] = useState<FilesModuleItem[]>([]);
  const [trackedProjectFiles, setTrackedProjectFiles] = useState<FilesModuleItem[]>([]);
  const [pendingPaneFilesByPaneId, setPendingPaneFilesByPaneId] = useState<Record<string, FilesModuleItem[]>>({});
  const [trackedPaneFilesByPaneId, setTrackedPaneFilesByPaneId] = useState<Record<string, FilesModuleItem[]>>({});
  const activePaneId = activePane?.pane_id ?? null;

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
        provider: 'nextcloud',
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

  const refreshTrackedProjectFiles = useCallback(async () => {
    const files = await listTrackedFiles(accessToken, projectId, { scope: 'project' });
    setTrackedProjectFiles(files.map(trackedFileToModuleItem));
  }, [accessToken, projectId]);

  const refreshTrackedPaneFiles = useCallback(
    async (paneIdToLoad: string) => {
      const files = await listTrackedFiles(accessToken, projectId, {
        scope: 'pane',
        pane_id: paneIdToLoad,
      });
      setTrackedPaneFilesByPaneId((current) => ({
        ...current,
        [paneIdToLoad]: files.map(trackedFileToModuleItem),
      }));
    },
    [accessToken, projectId],
  );

  useEffect(() => {
    void refreshAssetRoots();
  }, [refreshAssetRoots]);

  useEffect(() => {
    void refreshTrackedProjectFiles();
  }, [refreshTrackedProjectFiles]);

  useEffect(() => {
    if (!activePaneId) {
      return;
    }
    void refreshTrackedPaneFiles(activePaneId);
  }, [activePaneId, refreshTrackedPaneFiles]);

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

  const updatePendingPaneFile = useCallback(
    (paneIdToUpdate: string, fileId: string, mapFn: (current: FilesModuleItem) => FilesModuleItem) => {
      setPendingPaneFilesByPaneId((current) => {
        const paneFiles = current[paneIdToUpdate] ?? [];
        const nextPaneFiles = paneFiles.map((item) => (item.id === fileId ? mapFn(item) : item));
        return {
          ...current,
          [paneIdToUpdate]: nextPaneFiles,
        };
      });
    },
    [],
  );

  const updatePendingProjectFile = useCallback((fileId: string, mapFn: (current: FilesModuleItem) => FilesModuleItem) => {
    setPendingProjectFiles((current) => current.map((item) => (item.id === fileId ? mapFn(item) : item)));
  }, []);

  const removePendingPaneFile = useCallback((paneIdToUpdate: string, fileId: string) => {
    setPendingPaneFilesByPaneId((current) => ({
      ...current,
      [paneIdToUpdate]: (current[paneIdToUpdate] ?? []).filter((item) => item.id !== fileId),
    }));
  }, []);

  const removePendingProjectFile = useCallback((fileId: string) => {
    setPendingProjectFiles((current) => current.filter((item) => item.id !== fileId));
  }, []);

  const onUploadProjectFiles = useCallback(
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
        } satisfies FilesModuleItem,
      }));

      setPendingProjectFiles((current) => [...queued.map((entry) => entry.item), ...current]);

      for (const entry of queued) {
        const timer = window.setInterval(() => {
          updatePendingProjectFile(entry.item.id, (current) => {
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
              project_id: projectId,
              asset_root_id: assetRootId,
              name: entry.localFile.name,
              mime_type: entry.localFile.type || 'application/octet-stream',
              content_base64: base64,
              path: 'Project Files',
              mutation_context_pane_id: activePane?.pane_id || undefined,
              metadata: {
                scope: 'project',
              },
            });

            updatePendingProjectFile(entry.item.id, (current) => ({
              ...current,
              uploadProgress: 100,
              uploadedAt: new Date().toLocaleString(),
              uploadedAtTimestamp: Date.now(),
              sizeLabel: formatFileSize(uploaded.file.size_bytes),
              sizeBytes: uploaded.file.size_bytes,
              openUrl: uploaded.file.proxy_url,
              thumbnailUrl: uploaded.file.proxy_url,
            }));

            await refreshTrackedProjectFiles();
            const removalTimer = window.setTimeout(() => {
              removePendingProjectFile(entry.item.id);
              delete fileRemovalTimersRef.current[entry.item.id];
            }, 450);
            fileRemovalTimersRef.current[entry.item.id] = removalTimer;
          } catch (error) {
            updatePendingProjectFile(entry.item.id, (current) => ({
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
    [accessToken, activePane?.pane_id, ensureProjectAssetRoot, onError, projectId, refreshTrackedProjectFiles, removePendingProjectFile, updatePendingProjectFile],
  );

  const onUploadPaneFiles = useCallback(
    (nextFiles: File[]) => {
      if (!activePane || nextFiles.length === 0) {
        return;
      }

      const paneIdForUpload = activePane.pane_id;
      const panePath = `Pane Files/${paneIdForUpload}`;
      const startedAt = new Date().toLocaleString();
      const startedAtTimestamp = Date.now();
      const queued = nextFiles.map((file) => ({
        localFile: file,
        item: {
          id: `pane-file-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          name: file.name,
          ext: fileExt(file.name),
          sizeLabel: formatFileSize(file.size),
          uploadedAt: startedAt,
          uploadedAtTimestamp: startedAtTimestamp,
          uploadProgress: 1,
          sizeBytes: file.size,
        } satisfies FilesModuleItem,
      }));

      setPendingPaneFilesByPaneId((current) => ({
        ...current,
        [paneIdForUpload]: [...queued.map((entry) => entry.item), ...(current[paneIdForUpload] ?? [])],
      }));

      for (const entry of queued) {
        const timer = window.setInterval(() => {
          updatePendingPaneFile(paneIdForUpload, entry.item.id, (current) => {
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
              project_id: projectId,
              asset_root_id: assetRootId,
              name: entry.localFile.name,
              mime_type: entry.localFile.type || 'application/octet-stream',
              content_base64: base64,
              path: panePath,
              mutation_context_pane_id: paneIdForUpload,
              metadata: {
                scope: 'pane',
                pane_id: paneIdForUpload,
                pane_name: activePane.name,
              },
            });

            updatePendingPaneFile(paneIdForUpload, entry.item.id, (current) => ({
              ...current,
              uploadProgress: 100,
              uploadedAt: new Date().toLocaleString(),
              uploadedAtTimestamp: Date.now(),
              sizeLabel: formatFileSize(uploaded.file.size_bytes),
              sizeBytes: uploaded.file.size_bytes,
              openUrl: uploaded.file.proxy_url,
              thumbnailUrl: uploaded.file.proxy_url,
            }));

            await Promise.all([refreshTrackedProjectFiles(), refreshTrackedPaneFiles(paneIdForUpload)]);
            const removalTimer = window.setTimeout(() => {
              removePendingPaneFile(paneIdForUpload, entry.item.id);
              delete fileRemovalTimersRef.current[entry.item.id];
            }, 450);
            fileRemovalTimersRef.current[entry.item.id] = removalTimer;
          } catch (error) {
            updatePendingPaneFile(paneIdForUpload, entry.item.id, (current) => ({
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
    [accessToken, activePane, ensureProjectAssetRoot, onError, projectId, refreshTrackedPaneFiles, refreshTrackedProjectFiles, removePendingPaneFile, updatePendingPaneFile],
  );

  const onOpenPaneFile = useCallback((file: FilesModuleItem) => {
    if (file.openUrl) {
      window.open(file.openUrl, '_blank', 'noopener');
    }
  }, []);

  const paneFiles = useMemo(() => {
    if (!activePane) {
      return [];
    }
    const combined = [...(pendingPaneFilesByPaneId[activePane.pane_id] ?? []), ...(trackedPaneFilesByPaneId[activePane.pane_id] ?? [])];
    return combined.sort((left, right) => {
      const leftTime = left.uploadedAtTimestamp ?? Number(new Date(left.uploadedAt));
      const rightTime = right.uploadedAtTimestamp ?? Number(new Date(right.uploadedAt));
      const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY;
      const safeRight = Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY;
      return safeRight - safeLeft;
    });
  }, [activePane, pendingPaneFilesByPaneId, trackedPaneFilesByPaneId]);

  const projectFiles = useMemo(
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
    onOpenPaneFile,
    onUploadPaneFiles,
    onUploadProjectFiles,
    paneFiles,
    projectFiles,
    refreshTrackedProjectFiles,
  };
};
