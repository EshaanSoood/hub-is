import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from './helpers/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function globalSetup(): Promise<void> {
  const timeoutMs = Number.parseInt(process.env.E2E_MINT_TOKENS_TIMEOUT_MS || '60000', 10);
  const mintTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000;

  try {
    execSync('node scripts/mint-tokens.mjs', {
      cwd: __dirname,
      stdio: 'inherit',
      timeout: mintTimeoutMs,
    });
  } catch (error) {
    throw new Error(`Failed to mint E2E tokens within ${mintTimeoutMs}ms.`, {
      cause: error instanceof Error ? error : undefined,
    });
  }

  const tokensPath = resolve(__dirname, '.env.tokens.local');
  const envMap = parseEnvFile(readFileSync(tokensPath, 'utf8'));

  const tokenA = (envMap.TOKEN_A || '').trim();
  const tokenB = (envMap.TOKEN_B || '').trim();

  if (!tokenA || !tokenB) {
    throw new Error(`Expected TOKEN_A and TOKEN_B in ${tokensPath}`);
  }

  process.env.TOKEN_A = tokenA;
  process.env.TOKEN_B = tokenB;
}
