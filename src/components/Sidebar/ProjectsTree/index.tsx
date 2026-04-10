import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { useProjects } from '../../../context/ProjectsContext';
import { buildProjectOverviewHref, buildProjectWorkHref } from '../../../lib/hubRoutes';
import { listPanes, updatePane } from '../../../services/hub/panes';
import { updateProject } from '../../../services/hub/projects';
import type { HubPaneSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import { SidebarLabel } from '../motion/SidebarLabel';
import {
  sidebarAccordionContentVariants,
  sidebarAccordionItemVariants,
  sidebarAccordionListVariants,
  sidebarChevronVariants,
} from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';
import { AddPaneAction } from './AddPaneAction';
import { NewProjectAction } from './NewProjectAction';
import { PaneNode } from './PaneNode';
import { ProjectNode } from './ProjectNode';
import { useProjectReorder } from './useProjectReorder';

const sortPanes = (panes: HubPaneSummary[]): HubPaneSummary[] =>
  [...panes].sort((left, right) => (left.position ?? left.sort_order) - (right.position ?? right.sort_order));

const decodePathSegment = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

interface ProjectsTreeProps {
  currentProject: ProjectRecord | null;
  currentProjectPanes: HubPaneSummary[];
  isCollapsed: boolean;
  onExpandSidebar: () => void;
  showLabels: boolean;
}

export const ProjectsTree = ({
  currentProject,
  currentProjectPanes,
  isCollapsed,
  onExpandSidebar,
  showLabels,
}: ProjectsTreeProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { accessToken } = useAuthz();
  const { projects, refreshProjects } = useProjects();
  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isOnHome = normalizedPathname === '/projects';
  const currentProjectId = useMemo(
    () => decodePathSegment(normalizedPathname.match(/^\/projects\/([^/]+)/)?.[1] || null),
    [normalizedPathname],
  );
  const currentPaneId = useMemo(
    () => decodePathSegment(normalizedPathname.match(/^\/projects\/[^/]+\/work\/([^/]+)/)?.[1] || null),
    [normalizedPathname],
  );
  const [sectionExpanded, setSectionExpanded] = useState(() => !isOnHome);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>(() => (currentProjectId ? [currentProjectId] : []));
  const [loadingProjectIds, setLoadingProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panesByProjectId, setPanesByProjectId] = useState<Record<string, HubPaneSummary[]>>(() =>
    currentProject?.id ? { [currentProject.id]: sortPanes(currentProjectPanes) } : {},
  );

  const visibleProjects = useMemo(() => {
    const teamProjects = projects.filter((project) => !project.isPersonal);
    if (!isOnHome && currentProject) {
      return teamProjects.filter((project) => project.id === currentProject.id);
    }
    return teamProjects;
  }, [currentProject, isOnHome, projects]);

  useEffect(() => {
    if (currentProject?.id) {
      setPanesByProjectId((current) => ({
        ...current,
        [currentProject.id]: sortPanes(currentProjectPanes),
      }));
    }
  }, [currentProject?.id, currentProjectPanes]);

  useEffect(() => {
    if (!isOnHome && currentProjectId) {
      setSectionExpanded(true);
      setExpandedProjectIds((current) => (current.includes(currentProjectId) ? current : [...current, currentProjectId]));
    }
  }, [currentProjectId, isOnHome]);

  const loadProjectPanes = useCallback(
    async (projectId: string) => {
      if (!accessToken || loadingProjectIds.includes(projectId)) {
        return;
      }
      setLoadingProjectIds((current) => [...current, projectId]);
      try {
        const panes = await listPanes(accessToken, projectId);
        setPanesByProjectId((current) => ({ ...current, [projectId]: sortPanes(panes) }));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load panes.');
      } finally {
        setLoadingProjectIds((current) => current.filter((entry) => entry !== projectId));
      }
    },
    [accessToken, loadingProjectIds],
  );

  const onToggleProject = useCallback(
    (projectId: string) => {
      setExpandedProjectIds((current) => {
        if (current.includes(projectId)) {
          return current.filter((entry) => entry !== projectId);
        }
        void loadProjectPanes(projectId);
        return [...current, projectId];
      });
    },
    [loadProjectPanes],
  );

  const projectIds = useMemo(() => visibleProjects.map((project) => project.id), [visibleProjects]);
  const focusedPanes = useMemo(
    () => (currentProjectId ? panesByProjectId[currentProjectId] ?? [] : []),
    [currentProjectId, panesByProjectId],
  );

  const onProjectReorder = useCallback(
    async (nextProjectIds: string[]) => {
      if (!accessToken) {
        return;
      }
      try {
        await Promise.all(
          nextProjectIds.map((projectId, index) => updateProject(accessToken, projectId, { position: index })),
        );
        await refreshProjects();
      } catch (reorderError) {
        setError(reorderError instanceof Error ? reorderError.message : 'Failed to reorder projects.');
        await refreshProjects().catch(() => undefined);
      }
    },
    [accessToken, refreshProjects],
  );

  const {
    orderedItemIds: orderedProjectIds,
    sensors: projectSensors,
    handleDragEnd: handleProjectDragEnd,
  } = useProjectReorder({
    enabled: sectionExpanded && isOnHome,
    itemIds: projectIds,
    onReorder: onProjectReorder,
  });

  const focusedPaneIds = useMemo(() => focusedPanes.map((pane) => pane.pane_id), [focusedPanes]);
  const onPaneReorder = useCallback(
    async (nextPaneIds: string[]) => {
      if (!accessToken || !currentProjectId) {
        return;
      }
      try {
        await Promise.all(
          nextPaneIds.map((paneId, index) =>
            updatePane(accessToken, paneId, {
              sort_order: index + 1,
              position: index + 1,
            })),
        );
        const refreshed = await listPanes(accessToken, currentProjectId);
        setPanesByProjectId((current) => ({ ...current, [currentProjectId]: sortPanes(refreshed) }));
      } catch (reorderError) {
        setError(reorderError instanceof Error ? reorderError.message : 'Failed to reorder panes.');
      }
    },
    [accessToken, currentProjectId],
  );

  const {
    orderedItemIds: orderedFocusedPaneIds,
    sensors: paneSensors,
    handleDragEnd: handlePaneDragEnd,
  } = useProjectReorder({
    enabled: sectionExpanded && !isOnHome && focusedPaneIds.length > 1,
    itemIds: focusedPaneIds,
    onReorder: onPaneReorder,
  });

  const projectsById = useMemo(
    () => new Map(visibleProjects.map((project) => [project.id, project])),
    [visibleProjects],
  );
  const displayedProjects = useMemo(
    () =>
      (isOnHome ? orderedProjectIds : projectIds)
        .map((projectId) => projectsById.get(projectId))
        .filter((project): project is ProjectRecord => Boolean(project)),
    [isOnHome, orderedProjectIds, projectIds, projectsById],
  );

  if (isCollapsed) {
    return (
      <button
        type="button"
        aria-label="Open projects"
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onExpandSidebar}
      >
        <Icon name="project-list" size={16} />
      </button>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-subtle bg-surface px-2 py-2">
      <button
        type="button"
        aria-expanded={sectionExpanded}
        className="interactive interactive-subtle flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-sm font-semibold text-text-secondary hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={() => setSectionExpanded((current) => !current)}
      >
        <motion.span
          initial={false}
          animate={sectionExpanded ? 'expanded' : 'collapsed'}
          variants={sidebarChevronVariants(prefersReducedMotion)}
          className="flex shrink-0"
        >
          <Icon name="chevron-down" size={14} />
        </motion.span>
        <SidebarLabel show={showLabels}>
          <span>Projects</span>
        </SidebarLabel>
      </button>

      <AnimatePresence initial={false}>
        {sectionExpanded ? (
          <motion.div
            key="projects-content"
            initial="collapsed"
            animate="expanded"
            exit="exit"
            variants={sidebarAccordionContentVariants(prefersReducedMotion)}
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <SidebarLabel show={showLabels} className="flex min-h-0 flex-1 flex-col gap-3">
              {!isOnHome && currentProject ? (
                <div className="shrink-0 flex flex-wrap items-center gap-1 px-2 text-xs text-muted">
                  <Link
                    to="/projects"
                    className="interactive interactive-subtle rounded-control px-1 py-0.5 text-muted hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    myHub
                  </Link>
                  <span>/</span>
                  <Link
                    to={buildProjectOverviewHref(currentProject.id)}
                    className="interactive interactive-subtle rounded-control px-1 py-0.5 text-muted hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    {currentProject.name}
                  </Link>
                  {currentPaneId ? (
                    <>
                      <span>/</span>
                      <span className="truncate text-text-secondary">
                        {focusedPanes.find((pane) => pane.pane_id === currentPaneId)?.name || 'Pane'}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="shrink-0 px-2 text-xs text-danger">{error}</p> : null}

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {displayedProjects.length > 0 ? (
                  <DndContext sensors={projectSensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                    <SortableContext items={isOnHome ? orderedProjectIds : projectIds} strategy={verticalListSortingStrategy}>
                      <motion.div
                        initial={false}
                        animate="expanded"
                        variants={sidebarAccordionListVariants(prefersReducedMotion)}
                        className="space-y-1"
                      >
                        {displayedProjects.map((project) => {
                          const projectPanes = panesByProjectId[project.id] ?? [];
                          const isExpanded = expandedProjectIds.includes(project.id);
                          const isActiveProject = project.id === currentProjectId;
                          const paneIdsForRender = isActiveProject && !isOnHome ? orderedFocusedPaneIds : projectPanes.map((pane) => pane.pane_id);
                          const panesForRender = paneIdsForRender
                            .map((paneId) => projectPanes.find((pane) => pane.pane_id === paneId))
                            .filter((pane): pane is HubPaneSummary => Boolean(pane));

                          return (
                            <motion.div
                              key={project.id}
                              variants={sidebarAccordionItemVariants(prefersReducedMotion)}
                              initial="collapsed"
                              animate="expanded"
                            >
                              <ProjectNode
                                active={isActiveProject}
                                expanded={isExpanded}
                                label={project.name}
                                onNavigate={() => navigate(buildProjectOverviewHref(project.id))}
                                onToggleExpanded={() => onToggleProject(project.id)}
                                sortableEnabled={isOnHome}
                                sortableId={project.id}
                              >
                                <AnimatePresence initial={false}>
                                  {isExpanded ? (
                                    <motion.div
                                      key={`${project.id}:panes`}
                                      initial="collapsed"
                                      animate="expanded"
                                      exit="exit"
                                      variants={sidebarAccordionContentVariants(prefersReducedMotion)}
                                      className="mt-1 ml-8 overflow-hidden"
                                    >
                                      {loadingProjectIds.includes(project.id) ? (
                                        <p className="px-3 py-2 text-xs text-muted">Loading panes…</p>
                                      ) : panesForRender.length > 0 ? (
                                        isActiveProject && !isOnHome ? (
                                          <DndContext sensors={paneSensors} collisionDetection={closestCenter} onDragEnd={handlePaneDragEnd}>
                                            <SortableContext items={orderedFocusedPaneIds} strategy={verticalListSortingStrategy}>
                                              <motion.div
                                                initial={false}
                                                animate="expanded"
                                                variants={sidebarAccordionListVariants(prefersReducedMotion)}
                                                className="space-y-1"
                                              >
                                                {panesForRender.map((pane) => (
                                                  <motion.div
                                                    key={pane.pane_id}
                                                    variants={sidebarAccordionItemVariants(prefersReducedMotion)}
                                                    initial="collapsed"
                                                    animate="expanded"
                                                  >
                                                    <PaneNode
                                                      active={pane.pane_id === currentPaneId}
                                                      label={pane.name}
                                                      onClick={() => navigate(buildProjectWorkHref(project.id, pane.pane_id))}
                                                      sortableEnabled
                                                      sortableId={pane.pane_id}
                                                    />
                                                  </motion.div>
                                                ))}
                                              </motion.div>
                                            </SortableContext>
                                          </DndContext>
                                        ) : (
                                          <motion.div
                                            initial={false}
                                            animate="expanded"
                                            variants={sidebarAccordionListVariants(prefersReducedMotion)}
                                            className="space-y-1"
                                          >
                                            {panesForRender.map((pane) => (
                                              <motion.div
                                                key={pane.pane_id}
                                                variants={sidebarAccordionItemVariants(prefersReducedMotion)}
                                                initial="collapsed"
                                                animate="expanded"
                                              >
                                                <PaneNode
                                                  active={pane.pane_id === currentPaneId}
                                                  label={pane.name}
                                                  onClick={() => navigate(buildProjectWorkHref(project.id, pane.pane_id))}
                                                  sortableEnabled={false}
                                                  sortableId={pane.pane_id}
                                                />
                                              </motion.div>
                                            ))}
                                          </motion.div>
                                        )
                                      ) : (
                                        <p className="px-3 py-2 text-xs text-muted">No panes yet.</p>
                                      )}

                                      <AddPaneAction
                                        panes={projectPanes}
                                        projectId={project.id}
                                        onPaneCreated={(pane) => {
                                          setExpandedProjectIds((current) => (current.includes(project.id) ? current : [...current, project.id]));
                                          setPanesByProjectId((current) => ({
                                            ...current,
                                            [project.id]: sortPanes([...(current[project.id] ?? []), pane]),
                                          }));
                                        }}
                                      />
                                    </motion.div>
                                  ) : null}
                                </AnimatePresence>
                              </ProjectNode>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="px-2 text-sm text-muted">No projects yet.</p>
                )}
              </div>

              <div className="shrink-0">
                <NewProjectAction />
              </div>
            </SidebarLabel>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
