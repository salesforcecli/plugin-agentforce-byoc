/*
 * Read a BYOC project's config.json. The SDK's config carries `entryPoint`;
 * `name`/`version` may also be present and fall back to sensible defaults.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type ProjectConfig = {
  entryPoint: string;
  name?: string;
  version?: string;
};

export async function readProjectConfig(projectDir: string): Promise<ProjectConfig> {
  const configPath = path.join(projectDir, 'config.json');
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    throw new Error(`config.json not found in ${projectDir}. Run 'sf agentforce-byoc init' first.`);
  }
  let parsed: Partial<ProjectConfig>;
  try {
    parsed = JSON.parse(raw) as Partial<ProjectConfig>;
  } catch (e) {
    throw new Error(`Invalid config.json: ${(e as Error).message}`);
  }
  return {
    entryPoint: parsed.entryPoint ?? 'main.py',
    name: parsed.name,
    version: parsed.version,
  };
}
