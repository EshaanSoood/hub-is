import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Stack } from '../components/layout/Stack';

export const NotFoundPage = () => (
  <div>
    <PageHeader title="Page not found" description="The route you requested is not part of the control plane." />
    <Stack gap="md">
      <Link to="/" className="interactive interactive-fold w-fit rounded-panel bg-primary px-3 py-2 text-sm font-semibold text-on-primary">
        Return to hub
      </Link>
    </Stack>
  </div>
);
