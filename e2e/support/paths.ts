import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const REPO_ROOT = resolve(__dirname, '..', '..');
export const PLAYWRIGHT_STATE_DIR = resolve(REPO_ROOT, '.playwright');
export const OWNER_STORAGE_STATE_PATH = resolve(PLAYWRIGHT_STATE_DIR, 'owner-storage-state.json');
export const VIEWER_STORAGE_STATE_PATH = resolve(PLAYWRIGHT_STATE_DIR, 'viewer-storage-state.json');
export const AUDIT_FIXTURE_PATH = resolve(PLAYWRIGHT_STATE_DIR, 'audit-fixture.json');
