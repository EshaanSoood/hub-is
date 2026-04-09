import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

interface JourneyTestResult {
  project: string;
  title: string;
  status: TestResult['status'];
  duration_ms: number;
  error?: string;
}

interface JourneyReport {
  scenario: string;
  generated_at: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    timed_out: number;
    interrupted: number;
  };
  tests: JourneyTestResult[];
}

const resolveReportPath = (): string => {
  return path.resolve(
    process.cwd(),
    process.env.JOURNEY_REPORT_PATH || path.join('e2e', 'user-journey-verification', 'report.json'),
  );
};

class JourneyReporter implements Reporter {
  private readonly tests: JourneyTestResult[] = [];

  private config!: FullConfig;

  onBegin(config: FullConfig, _suite: Suite): void {
    this.config = config;
    void this.config;
    void _suite;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const projectName = test.parent.project()?.name || 'unknown';
    const error = result.error?.message?.split('\n')[0]?.trim();

    this.tests.push({
      project: projectName,
      title: test.titlePath().join(' > '),
      status: result.status,
      duration_ms: result.duration,
      ...(error ? { error } : {}),
    });
  }

  async onEnd(): Promise<void> {
    const summary = {
      total: this.tests.length,
      passed: this.tests.filter((entry) => entry.status === 'passed').length,
      failed: this.tests.filter((entry) => entry.status === 'failed').length,
      skipped: this.tests.filter((entry) => entry.status === 'skipped').length,
      timed_out: this.tests.filter((entry) => entry.status === 'timedOut').length,
      interrupted: this.tests.filter((entry) => entry.status === 'interrupted').length,
    };

    const report: JourneyReport = {
      scenario: process.env.JOURNEY_SCENARIO || 'baseline',
      generated_at: new Date().toISOString(),
      summary,
      tests: this.tests,
    };

    const reportPath = resolveReportPath();
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
}

export default JourneyReporter;
