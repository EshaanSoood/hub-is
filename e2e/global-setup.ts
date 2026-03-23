import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parseEnvFile = (raw: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const splitIndex = trimmed.indexOf('=');
    if (splitIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, splitIndex).trim();
    let value = trimmed.slice(splitIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
};

export default async function globalSetup(): Promise<void> {
  execSync('node scripts/mint-tokens.mjs', {
    cwd: __dirname,
    stdio: 'inherit',
  });

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
