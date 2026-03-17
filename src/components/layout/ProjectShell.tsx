import type { ReactNode } from 'react';
import type { ProjectRecord } from '../../types/domain';
import { DataList } from './DataList';
import { Panel } from './Panel';
import { PageHeader } from './PageHeader';
import { Stack } from './Stack';

export const ProjectShell = ({
  project,
  children,
}: {
  project: ProjectRecord;
  children: ReactNode;
}) => (
  <div>
    <PageHeader title={project.name} description={project.summary} />

    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
      <aside className="lg:col-span-1">
        <Stack gap="lg">
          <Panel title="Project Metadata" headingLevel={3}>
            <DataList
              items={[
                { label: 'Membership', value: project.membershipRole },
                { label: 'Status', value: project.status },
              ]}
            />
          </Panel>

          <Panel title="Linked External IDs" headingLevel={3}>
            <DataList
              items={[
                { label: 'OpenProject Project', value: project.openProjectProjectId || 'pending' },
                { label: 'Nextcloud Folder', value: project.nextcloudFolder || 'pending' },
                { label: 'Notes Space', value: 'Hub-managed notes (internal)' },
              ]}
            />
          </Panel>
        </Stack>
      </aside>

      <div className="lg:col-span-2">
        <Stack gap="lg">{children}</Stack>
      </div>
    </div>
  </div>
);
