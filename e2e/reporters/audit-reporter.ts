import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

const AREA_NAMES = [
  'Authentication & Session',
  'myHub',
  'Projects',
  'Panes',
  'Document Editor (Collaborative Lexical Editor)',
  'Collections & Records',
  'Calendar & Events',
  'Tasks',
  'Files',
  'Notifications',
  'Permissions & Role Gating',
  'Quick Add / NLP',
  'Navigation & Shell',
  'Error States',
] as const;

type AreaName = (typeof AREA_NAMES)[number];

interface AuditEntry {
  area: AreaName;
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  failure: string;
  screenshotPath: string | null;
  consoleErrors: string[];
  knownGaps: string[];
}

const git = (args: string[]): string => {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const findArea = (test: TestCase): AreaName | null => {
  if (test.parent.project()?.name === 'setup' || test.location.file.endsWith('auth.setup.ts')) {
    return 'Authentication & Session';
  }
  const titlePath = test.titlePath();
  return AREA_NAMES.find((area) => titlePath.includes(area)) || null;
};

const readAttachmentText = (result: TestResult, attachmentName: string): string[] => {
  return result.attachments
    .filter((attachment) => attachment.name === attachmentName)
    .flatMap((attachment) => {
      try {
        if (attachment.body) {
          return [attachment.body.toString('utf8')];
        }
        if (attachment.path) {
          return [readFileSync(attachment.path, 'utf8')];
        }
      } catch {
        return [];
      }
      return [];
    });
};

class AuditReporter implements Reporter {
  private entries: AuditEntry[] = [];
  private config!: FullConfig;

  onBegin(config: FullConfig, _suite: Suite): void {
    void _suite;
    this.config = config;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const area = findArea(test);
    if (!area) {
      return;
    }

    const consoleErrors = readAttachmentText(result, `console-errors-owner`)
      .concat(readAttachmentText(result, `console-errors-keycloak-login`))
      .concat(readAttachmentText(result, `console-errors-viewer-pane-permissions`))
      .concat(readAttachmentText(result, `console-errors-owner-doc-a`))
      .concat(readAttachmentText(result, `console-errors-owner-doc-b`))
      .concat(readAttachmentText(result, `console-errors-viewer-role-gating`))
      .concat(readAttachmentText(result, `console-errors-viewer-pin-button`))
      .map((raw) => {
        try {
          const parsed = JSON.parse(raw) as { consoleErrors?: string[]; pageErrors?: string[] };
          return [...(parsed.consoleErrors || []), ...(parsed.pageErrors || [])];
        } catch {
          return [];
        }
      })
      .flat();

    const screenshotPath =
      result.attachments.find((attachment) => attachment.name === 'screenshot')?.path || null;

    this.entries.push({
      area,
      title: test.parent.project()?.name === 'setup' ? 'Setup auth state and audit fixture' : test.title,
      status: result.status,
      failure:
        result.errors[0]?.message?.split('\n').map((line) => line.trim()).filter(Boolean)[0] ||
        '',
      screenshotPath,
      consoleErrors,
      knownGaps: test.annotations
        .filter((annotation) => annotation.type === 'known-gap' && annotation.description)
        .map((annotation) => annotation.description as string),
    });
  }

  async onEnd(): Promise<void> {
    const counted = this.entries.filter((entry) => entry.status !== 'skipped');
    const passed = counted.filter((entry) => entry.status === 'passed').length;
    const failed = counted.filter((entry) => entry.status === 'failed').length;
    const branch = git(['branch', '--show-current']);
    const commit = git(['rev-parse', 'HEAD']);
    const timestamp = new Date().toISOString();
    const consoleErrors = Array.from(new Set(this.entries.flatMap((entry) => entry.consoleErrors))).filter(Boolean);
    const knownGaps = Array.from(new Set(this.entries.flatMap((entry) => entry.knownGaps))).filter(Boolean);

    console.log('=== Hub OS E2E AUDIT REPORT ===');
    console.log('');
    console.log(`Date: ${timestamp}`);
    console.log(`Branch: ${branch}`);
    console.log(`Commit: ${commit}`);
    console.log('');
    console.log('SUMMARY');
    console.log(`Total: ${counted.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('Skipped: 0');
    console.log('');
    console.log('RESULTS BY AREA');

    for (const area of AREA_NAMES) {
      console.log(`[${area}]`);
      const entries = this.entries.filter((entry) => entry.area === area);
      for (const entry of entries) {
        const marker = entry.status === 'passed' ? '✓' : '✗';
        const suffix = entry.status === 'failed' && entry.failure ? ` — ${entry.failure}` : '';
        console.log(`  ${marker} ${entry.title}${suffix}`);
      }
      if (entries.length === 0) {
        console.log('  ✗ No tests recorded');
      }
      console.log('');
    }

    console.log('CONSOLE ERRORS CAPTURED');
    if (consoleErrors.length === 0) {
      console.log('  None.');
    } else {
      for (const error of consoleErrors) {
        console.log(`  ${error}`);
      }
    }
    console.log('');

    console.log('FAILED TEST DETAILS');
    const failures = this.entries.filter((entry) => entry.status === 'failed');
    if (failures.length === 0) {
      console.log('  None.');
    } else {
      for (const failure of failures) {
        console.log(`  ${failure.title}`);
        console.log(`    Expected vs actual: ${failure.failure || 'See Playwright assertion output.'}`);
        console.log(`    Screenshot: ${failure.screenshotPath || 'not captured'}`);
      }
    }
    console.log('');

    console.log('KNOWN GAPS (features not testable)');
    if (knownGaps.length === 0) {
      console.log('  None.');
    } else {
      for (const gap of knownGaps) {
        console.log(`  ${gap}`);
      }
    }
  }
}

export default AuditReporter;
