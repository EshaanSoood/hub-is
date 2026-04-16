import { Link } from 'react-router-dom';
import { Panel } from '../layout/Panel';
import { Stack } from '../layout/Stack';

export const AccessDeniedView = ({ message }: { message: string }) => (
  <Stack gap="md">
    <h1 className="heading-1 text-primary">Access denied</h1>
    <Panel title="Policy Gate Blocked" description={message}>
      <Link to="/projects" className="interactive interactive-fold inline-flex rounded-panel bg-primary px-3 py-2 text-sm font-semibold text-on-primary">
        Return to Projects
      </Link>
    </Panel>
  </Stack>
);
