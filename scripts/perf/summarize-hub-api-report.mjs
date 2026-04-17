import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');

const formatMetric = (value) => (Number.isFinite(value) ? `${value.toFixed(2)}ms` : 'n/a');

const formatCount = (value) => (Number.isFinite(value) ? String(Math.round(value)) : '0');

const tryParseJson = async (path) => {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
};

const findDensestByKey = (candidate, key) => {
  const visited = new Set();
  const queue = [candidate];
  let best = null;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (current[key] && typeof current[key] === 'object') {
      const size = Object.keys(current[key]).length;
      if (!best || size > Object.keys(best).length) {
        best = current[key];
      }
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return best;
};

const findSummaries = (candidate) => findDensestByKey(candidate, 'summaries');
const findCounters = (candidate) => findDensestByKey(candidate, 'counters');

const normalizeHistogram = (metricName, metric) => ({
  metricName,
  count: Number(metric?.count || 0),
  min: Number(metric?.min || 0),
  max: Number(metric?.max || 0),
  mean: Number(metric?.mean || 0),
  p50: Number(metric?.p50 ?? metric?.median ?? 0),
  p95: Number(metric?.p95 || 0),
  p99: Number(metric?.p99 || 0),
  p999: Number(metric?.p999 || 0),
});

export const summarizeHubApiReport = async (reportPath, options = {}) => {
  const report = await tryParseJson(reportPath);
  const summaries = findSummaries(report);
  const counters = findCounters(report);

  if (!summaries) {
    throw new Error(`Could not find Artillery summaries in ${reportPath}.`);
  }

  const overallLatency = summaries['http.response_time']
    ? normalizeHistogram('http.response_time', summaries['http.response_time'])
    : null;

  const endpointPrefix = 'plugins.metrics-by-endpoint.response_time.';
  const endpointLatencies = Object.entries(summaries)
    .filter(([metricName]) => metricName.startsWith(endpointPrefix))
    .map(([metricName, metric]) => ({
      ...normalizeHistogram(metricName, metric),
      endpoint: metricName.slice(endpointPrefix.length),
    }))
    .sort((left, right) => right.p95 - left.p95 || right.count - left.count);

  const statusCodes = Object.entries(counters || {})
    .filter(([metricName]) => metricName.startsWith('http.codes.'))
    .map(([metricName, value]) => ({ code: metricName.slice('http.codes.'.length), count: Number(value || 0) }))
    .sort((left, right) => right.count - left.count);

  const errorCounters = Object.entries(counters || {})
    .filter(([metricName]) => metricName.startsWith('errors.'))
    .map(([metricName, value]) => ({ code: metricName.slice('errors.'.length), count: Number(value || 0) }))
    .sort((left, right) => right.count - left.count);

  const summary = {
    reportPath,
    generatedAt: new Date().toISOString(),
    overallLatency,
    endpointLatencies,
    statusCodes,
    errorCounters,
  };

  if (options.writeJsonPath) {
    await writeFile(options.writeJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  if (options.writeMarkdownPath) {
    const lines = [];
    lines.push('# Hub API Perf Summary');
    lines.push('');
    lines.push(`- Report: \`${relative(repoRoot, reportPath)}\``);
    lines.push(`- Generated: \`${summary.generatedAt}\``);
    lines.push('');
    lines.push('## Overall');
    lines.push('');
    if (overallLatency) {
      lines.push('| Metric | Value |');
      lines.push('| --- | --- |');
      lines.push(`| Count | ${formatCount(overallLatency.count)} |`);
      lines.push(`| p50 | ${formatMetric(overallLatency.p50)} |`);
      lines.push(`| p95 | ${formatMetric(overallLatency.p95)} |`);
      lines.push(`| p99 | ${formatMetric(overallLatency.p99)} |`);
      lines.push(`| p99.9 | ${formatMetric(overallLatency.p999)} |`);
      lines.push(`| Mean | ${formatMetric(overallLatency.mean)} |`);
      lines.push(`| Max | ${formatMetric(overallLatency.max)} |`);
    } else {
      lines.push('No aggregate `http.response_time` histogram was found.');
    }
    lines.push('');
    lines.push('## Endpoint Latency');
    lines.push('');
    if (endpointLatencies.length > 0) {
      lines.push('| Endpoint | Count | p50 | p95 | p99.9 | Max |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      for (const metric of endpointLatencies) {
        lines.push(`| ${metric.endpoint} | ${formatCount(metric.count)} | ${formatMetric(metric.p50)} | ${formatMetric(metric.p95)} | ${formatMetric(metric.p999)} | ${formatMetric(metric.max)} |`);
      }
    } else {
      lines.push('No endpoint-level latency histograms were found.');
    }
    lines.push('');
    lines.push('## Status Codes');
    lines.push('');
    if (statusCodes.length > 0) {
      lines.push('| Status | Count |');
      lines.push('| --- | --- |');
      for (const status of statusCodes) {
        lines.push(`| ${status.code} | ${formatCount(status.count)} |`);
      }
    } else {
      lines.push('No HTTP status counters were found.');
    }
    lines.push('');
    lines.push('## Errors');
    lines.push('');
    if (errorCounters.length > 0) {
      lines.push('| Error | Count |');
      lines.push('| --- | --- |');
      for (const error of errorCounters) {
        lines.push(`| ${error.code} | ${formatCount(error.count)} |`);
      }
    } else {
      lines.push('No transport error counters were found.');
    }
    lines.push('');

    await writeFile(options.writeMarkdownPath, `${lines.join('\n')}\n`, 'utf8');
  }

  return summary;
};

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  const reportArg = process.argv[2];
  if (!reportArg) {
    console.error('Usage: npm run perf:hub-api:summary -- <report.json>');
    process.exit(1);
  }

  const reportPath = resolve(process.cwd(), reportArg);
  const summary = await summarizeHubApiReport(reportPath);

  if (summary.overallLatency) {
    console.log('Hub API latency summary');
    console.log(`p50=${formatMetric(summary.overallLatency.p50)} p95=${formatMetric(summary.overallLatency.p95)} p99.9=${formatMetric(summary.overallLatency.p999)}`);
  } else {
    console.log('No aggregate latency histogram found in report.');
  }

  if (summary.endpointLatencies.length > 0) {
    console.log('');
    console.log('Slowest endpoints by p95');
    for (const metric of summary.endpointLatencies.slice(0, 10)) {
      console.log(`${metric.endpoint} count=${formatCount(metric.count)} p95=${formatMetric(metric.p95)} p99.9=${formatMetric(metric.p999)}`);
    }
  }
}
