import { test } from '@playwright/test';
import { authenticateAsUserA } from '../helpers/auth';
import { runHubHomeAudit } from '../support/hubHomeAudit.ts';

test('collects the app shell and Hub Home accessibility audit artifacts', async ({ page }, testInfo) => {
  await authenticateAsUserA(page);

  const { outputDir, report } = await runHubHomeAudit(page);

  await testInfo.attach('hub-home-audit-summary', {
    body: Buffer.from(
      JSON.stringify(
        {
          outputDir,
          counts: {
            landmarks: report.landmarks.length,
            headings: report.headings.length,
            focusStops: report.focusStops.length,
            announcements: report.announcements.length,
            failures: report.failures.length,
          },
          failures: report.failures,
        },
        null,
        2,
      ),
      'utf8',
    ),
    contentType: 'application/json',
  });
});
