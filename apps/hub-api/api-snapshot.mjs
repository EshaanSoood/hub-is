import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HUB_API_FILE = path.join(__dirname, 'hub-api.mjs');
const DEFAULT_PORT = Number(process.env.PORT || '3001');
const DEFAULT_OUT_FILE = path.join(__dirname, 'api-snapshot.json');

const argv = process.argv.slice(2);

const readArg = (name) => {
  const index = argv.indexOf(name);
  if (index === -1) {
    return '';
  }
  return String(argv[index + 1] || '').trim();
};

const baseUrlArg = readArg('--base-url');
const outFileArg = readArg('--out');

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const exactRouteMatchers = [
  /if\s*\(\s*request\.method === '([A-Z]+)'\s*&&\s*pathname === '([^']+)'\s*\)\s*\{/,
  /if\s*\(\s*pathname === '([^']+)'\s*&&\s*request\.method === '([A-Z]+)'\s*\)\s*\{/,
];

const pathMatchDeclaration = /const\s+([A-Za-z0-9_]+)\s*=\s*pathMatch\(pathname,\s*(\/\^.+?\/[a-z]*)\s*\);/;

const routeIfWithMatch = (matchName) => [
  new RegExp(`if\\s*\\(\\s*request\\.method === '([A-Z]+)'\\s*&&\\s*${matchName}\\s*\\)\\s*\\{`),
  new RegExp(`if\\s*\\(\\s*${matchName}\\s*&&\\s*request\\.method === '([A-Z]+)'\\s*\\)\\s*\\{`),
];

const regexLiteralToPattern = (literal) => {
  const trimmed = String(literal || '').trim();
  return trimmed
    .replace(/^\/\^/, '')
    .replace(/\/[a-z]*$/, '')
    .replace(/\$$/, '')
    .replace(/\\\//g, '/');
};

const patternToSamplePath = (pattern) =>
  String(pattern || '')
    .replace(/\(\[\^\/\]\+\)/g, 'placeholder')
    .replace(/\(\?:[^)]+\)/g, 'placeholder')
    .replace(/[?+*]/g, '')
    .replace(/\\(.)/g, '$1');

const dedupeRoutes = (routes) => {
  const seen = new Set();
  return routes.filter((route) => {
    const key = `${route.method} ${route.path_pattern}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const parseRoutes = (source) => {
  const lines = source.split('\n');
  const pathMatchers = new Map();
  const routes = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const pathMatch = line.match(pathMatchDeclaration);
    if (pathMatch) {
      pathMatchers.set(pathMatch[1], {
        line: index + 1,
        regexLiteral: pathMatch[2],
      });
      continue;
    }

    for (const matcher of exactRouteMatchers) {
      const exactMatch = line.match(matcher);
      if (!exactMatch) {
        continue;
      }

      const method = exactMatch[1].startsWith('/') ? exactMatch[2] : exactMatch[1];
      const pathname = exactMatch[1].startsWith('/') ? exactMatch[1] : exactMatch[2];
      routes.push({
        line: index + 1,
        method,
        path: pathname,
        path_pattern: pathname,
        match_type: 'exact',
      });
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const [matchName, declaration] of pathMatchers.entries()) {
      for (const matcher of routeIfWithMatch(matchName)) {
        const ifMatch = line.match(matcher);
        if (!ifMatch) {
          continue;
        }

        const method = ifMatch[1];
        const pattern = regexLiteralToPattern(declaration.regexLiteral);
        routes.push({
          line: index + 1,
          method,
          path: patternToSamplePath(pattern),
          path_pattern: pattern,
          match_type: 'path_match',
        });
      }
    }
  }

  return dedupeRoutes(routes).sort((left, right) => left.line - right.line);
};

const mergeShape = (left, right) => {
  if (left === undefined) {
    return right;
  }
  if (right === undefined) {
    return left;
  }
  if (left === right) {
    return left;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length === 0) {
      return right;
    }
    if (right.length === 0) {
      return left;
    }
    return [mergeShape(left[0], right[0])];
  }
  if (left && typeof left === 'object' && right && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    const merged = {};
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      merged[key] = mergeShape(left[key], right[key]);
    }
    return merged;
  }
  return [left, right].filter((value, index, values) => values.indexOf(value) === index).sort();
};

const shapeOf = (value) => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    const merged = value.map(shapeOf).reduce((accumulator, item) => mergeShape(accumulator, item), undefined);
    return merged === undefined ? [] : [merged];
  }
  if (typeof value === 'object') {
    const shape = {};
    for (const key of Object.keys(value).sort()) {
      shape[key] = shapeOf(value[key]);
    }
    return shape;
  }
  return typeof value;
};

const buildRequestInit = (method) => {
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    return {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    };
  }
  return { method };
};

const buildRouteSnapshot = async (baseUrl, route) => {
  const response = await fetch(`${baseUrl}${route.path}`, buildRequestInit(route.method));
  const contentType = response.headers.get('content-type') || '';
  const bodyText = await response.text();

  let bodyShape = null;
  if (contentType.toLowerCase().includes('application/json')) {
    try {
      bodyShape = shapeOf(JSON.parse(bodyText));
    } catch {
      bodyShape = { parse_error: 'invalid_json' };
    }
  } else if (bodyText) {
    bodyShape = 'non_json';
  }

  return {
    method: route.method,
    path: route.path,
    path_pattern: route.path_pattern,
    status_code: response.status,
    content_type: contentType,
    body_shape: bodyShape,
  };
};

const resolveBaseUrl = async () => {
  const candidates = [
    normalizeBaseUrl(baseUrlArg || process.env.HUB_API_BASE_URL),
    `http://127.0.0.1:${DEFAULT_PORT}`,
    `http://localhost:${DEFAULT_PORT}`,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}/api/hub/health`);
      if (response.ok) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(`Unable to reach a local hub API server. Tried: ${candidates.join(', ')}`);
};

const main = async () => {
  const source = await readFile(HUB_API_FILE, 'utf8');
  const routes = parseRoutes(source);
  const baseUrl = await resolveBaseUrl();
  const snapshots = [];

  for (const route of routes) {
    snapshots.push(await buildRouteSnapshot(baseUrl, route));
  }

  const payload = {
    base_url: baseUrl,
    route_count: snapshots.length,
    routes: snapshots,
  };

  const outputPath = outFileArg ? path.resolve(process.cwd(), outFileArg) : DEFAULT_OUT_FILE;
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  process.stdout.write(`Wrote ${snapshots.length} route snapshots to ${outputPath}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
