import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { useProjects } from '../../../context/ProjectsContext';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import { listProjects, updateProject } from '../../../services/hub/projects';
import { updateSpace } from '../../../services/hub/spaces';
import type { HubProjectSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import { SidebarLabel } from '../motion/SidebarLabel';
import {
  sidebarAccordionContentVariants,
  sidebarAccordionItemVariants,
  sidebarAccordionListVariants,
  sidebarChevronVariants,
} from '../motion/sidebarMotion';
import { Icon } from '../../primitives/Icon';
import { AddProjectAction } from './AddProjectAction';
import { NewProjectAction } from './NewProjectAction';
import { ProjectNode } from './ProjectNode';
import { useProjectReorder } from './useProjectReorder';

const sortProjects = (projects: HubProjectSummary[]): HubProjectSummary[] =>
  [...projects].sort((left, right) => (left.position ?? left.sort_order) - (right.position ?? right.sort_order));

interface ProjectsTreeProps {
  activeSpaceId: string | null;
  currentProjectProjects: HubProjectSummary[];
  currentSpaceProjectId: string | null;
  expandedProjectId: string | null;
  isCollapsed: boolean;
  onOpenProject: (projectId: string) => void;
  onExpandSidebar: () => void;
  onToggleProjectExpansion: (projectId: string) => void;
  onToggleSection: () => void;
  sectionExpanded: boolean;
  spaceFocused: boolean;
  showLabels: boolean;
}

export const ProjectsTree = ({
  activeSpaceId,
  currentProjectProjects,
  currentSpaceProjectId,
  expandedProjectId,
  isCollapsed,
  onOpenProject,
  onExpandSidebar,
  onToggleProjectExpansion,
  onToggleSection,
  sectionExpanded,
  spaceFocused,
  showLabels,
}: ProjectsTreeProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { accessToken } = useAuthz();
  const { projects, refreshProjects } = useProjects();
  const isOnHome = (location.pathname.replace(/\/+$/, '') || '/') === '/projects';
  const [loadingProjectIds, setLoadingProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [projectsBySpaceId, setProjectsByProjectId] = useState<Record<string, HubProjectSummary[]>>(() =>
    activeSpaceId ? { [activeSpaceId]: sortProjects(currentProjectProjects) } : {},
  );

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.isPersonal),
    [projects],
  );

  useEffect(() => {
    if (activeSpaceId) {
      setProjectsByProjectId((current) => ({
        ...current,
        [activeSpaceId]: sortProjects(currentProjectProjects),
      }));
    }
  }, [activeSpaceId, currentProjectProjects]);

  const loadProjectProjects = useCallback(
    async (projectId: string) => {
      if (!accessToken || loadingProjectIds.includes(projectId)) {
        return;
      }
      setLoadingProjectIds((current) => [...current, projectId]);
      try {
        const projects = await listProjects(accessToken, projectId);
        setProjectsByProjectId((current) => ({ ...current, [projectId]: sortProjects(projects) }));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load projects.');
      } finally {
        setLoadingProjectIds((current) => current.filter((entry) => entry !== projectId));
      }
    },
    [accessToken, loadingProjectIds],
  );

  useEffect(() => {
    if (!expandedProjectId || projectsBySpaceId[expandedProjectId] || !accessToken) {
      return;
    }
    void loadProjectProjects(expandedProjectId);
  }, [accessToken, expandedProjectId, loadProjectProjects, projectsBySpaceId]);

  const projectIds = useMemo(() => visibleProjects.map((project) => project.id), [visibleProjects]);
  const focusedProjects = useMemo(
    () => (activeSpaceId ? projectsBySpaceId[activeSpaceId] ?? [] : []),
    [activeSpaceId, projectsBySpaceId],
  );

  const onSpaceReorder = useCallback(
    async (nextProjectIds: string[]) => {
      if (!accessToken) {
        return;
      }
      try {
        await Promise.all(
          nextProjectIds.map((projectId, index) => updateSpace(accessToken, projectId, { position: index })),
        );
        await refreshProjects();
      } catch (reorderError) {
        setError(reorderError instanceof Error ? reorderError.message : 'Failed to reorder spaces.');
        await refreshProjects().catch(() => undefined);
      }
    },
    [accessToken, refreshProjects],
  );

  const {
    orderedItemIds: orderedProjectIds,
    sensors: projectSensors,
    handleDragEnd: handleSpaceDragEnd,
  } = useProjectReorder({
    enabled: sectionExpanded && isOnHome,
    itemIds: projectIds,
    onReorder: onSpaceReorder,
  });

  const focusedProjectIds = useMemo(() => focusedProjects.map((project) => project.project_id), [focusedProjects]);
  const onWorkProjectReorder = useCallback(
    async (nextProjectIds: string[]) => {
      if (!accessToken || !activeSpaceId) {
        return;
      }
      try {
        await Promise.all(
          nextProjectIds.map((projectId, index) =>
            updateProject(accessToken, projectId, {
              sort_order: index + 1,
              position: index + 1,
            })),
        );
        const refreshed = await listProjects(accessToken, activeSpaceId);
        setProjectsByProjectId((current) => ({ ...current, [activeSpaceId]: sortProjects(refreshed) }));
      } catch (reorderError) {
        setError(reorderError instanceof Error ? reorderError.message : 'Failed to reorder projects.');
      }
    },
    [accessToken, activeSpaceId],
  );

  const {
    orderedItemIds: orderedFocusedProjectIds,
    sensors: workProjectSensors,
    handleDragEnd: handleWorkProjectDragEnd,
  } = useProjectReorder({
    enabled: sectionExpanded && !isOnHome && focusedProjectIds.length > 1,
    itemIds: focusedProjectIds,
    onReorder: onWorkProjectReorder,
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
        aria-label="Open spaces"
        className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control bg-surface-container text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onExpandSidebar}
      >
        <Icon name="project-list" size={16} />
      </button>
    );
  }

  return (
    <section className="sidebar-divider flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">
      <button
        type="button"
        aria-expanded={sectionExpanded}
        className="interactive interactive-subtle sidebar-row w-full justify-between px-2 py-2 text-left text-sm font-semibold text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={onToggleSection}
      >
        <span className="flex min-w-0 items-center gap-2">
          <motion.span
            initial={false}
            animate={sectionExpanded ? 'expanded' : 'collapsed'}
            variants={sidebarChevronVariants(prefersReducedMotion)}
            className="flex shrink-0"
          >
            <Icon name="chevron-down" size={14} />
          </motion.span>
          <SidebarLabel show={showLabels}>
            <span>Spaces</span>
          </SidebarLabel>
        </span>
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
            <SidebarLabel show={showLabels} className="sidebar-children-indent flex min-h-0 flex-1 flex-col gap-3">
              {error ? <p className="shrink-0 px-2 text-xs text-danger">{error}</p> : null}

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {displayedProjects.length > 0 ? (
                  <DndContext sensors={projectSensors} collisionDetection={closestCenter} onDragEnd={handleSpaceDragEnd}>
                    <SortableContext items={isOnHome ? orderedProjectIds : projectIds} strategy={verticalListSortingStrategy}>
                      <motion.div
                        initial={false}
                        animate="expanded"
                        variants={sidebarAccordionListVariants(prefersReducedMotion)}
                        className="space-y-1"
                      >
                        {displayedProjects.map((project) => {
                          const projectProjects = projectsBySpaceId[project.id] ?? [];
                          const isExpanded = expandedProjectId === project.id;
                          const isActiveProject = project.id === activeSpaceId;
                          const projectIdsForRender = isActiveProject && !isOnHome ? orderedFocusedProjectIds : projectProjects.map((project) => project.project_id);
                          const projectsForRender = projectIdsForRender
                            .map((projectId) => projectProjects.find((project) => project.project_id === projectId))
                            .filter((project): project is HubProjectSummary => Boolean(project));

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
                                onNavigate={() => onOpenProject(project.id)}
                                onToggleExpanded={() => {
                                  if (!isExpanded && !projectsBySpaceId[project.id]) {
                                    void loadProjectProjects(project.id);
                                  }
                                  onToggleProjectExpansion(project.id);
                                }}
                                showToggle={spaceFocused}
                                sortableEnabled={isOnHome}
                                sortableId={project.id}
                              >
                                <AnimatePresence initial={false}>
                                  {isExpanded ? (
                                    <motion.div
                                      key={`${project.id}:projects`}
                                      initial="collapsed"
                                      animate="expanded"
                                      exit="exit"
                                      variants={sidebarAccordionContentVariants(prefersReducedMotion)}
                                      className="mt-1 ml-8 overflow-hidden"
                                    >
                                      {loadingProjectIds.includes(project.id) ? (
                                        <p className="px-3 py-2 text-xs text-muted">Loading projects…</p>
                                      ) : projectsForRender.length > 0 ? (
                                        isActiveProject && !isOnHome ? (
                                          <DndContext sensors={workProjectSensors} collisionDetection={closestCenter} onDragEnd={handleWorkProjectDragEnd}>
                                            <SortableContext items={orderedFocusedProjectIds} strategy={verticalListSortingStrategy}>
                                              <motion.div
                                                initial={false}
                                                animate="expanded"
                                                variants={sidebarAccordionListVariants(prefersReducedMotion)}
                                                className="space-y-1"
                                              >
                                                {projectsForRender.map((project) => (
                                                  <motion.div
                                                    key={project.project_id}
                                                    variants={sidebarAccordionItemVariants(prefersReducedMotion)}
                                                    initial="collapsed"
                                                    animate="expanded"
                                                  >
                                                    <ProjectNode
                                                      active={project.project_id === currentSpaceProjectId}
                                                      label={project.name}
                                                      onClick={() => navigate(buildProjectWorkHref(project.space_id, project.project_id))}
                                                      sortableEnabled
                                                      sortableId={project.project_id}
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
                                            {projectsForRender.map((project) => (
                                              <motion.div
                                                key={project.project_id}
                                                variants={sidebarAccordionItemVariants(prefersReducedMotion)}
                                                initial="collapsed"
                                                animate="expanded"
                                              >
                                                <ProjectNode
                                                  active={project.project_id === currentSpaceProjectId}
                                                  label={project.name}
                                                  onClick={() => navigate(buildProjectWorkHref(project.space_id, project.project_id))}
                                                  sortableEnabled={false}
                                                  sortableId={project.project_id}
                                                />
                                              </motion.div>
                                            ))}
                                          </motion.div>
                                        )
                                      ) : (
                                        <p className="px-3 py-2 text-xs text-muted">No projects yet.</p>
                                      )}

                                      <AddProjectAction
                                        projects={projectProjects}
                                        projectId={project.id}
                                        onProjectCreated={(project) => {
                                          setProjectsByProjectId((current) => ({
                                            ...current,
                                            [project.space_id]: sortProjects([...(current[project.space_id] ?? []), project]),
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
                  <p className="px-2 text-sm text-muted">No spaces yet.</p>
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
