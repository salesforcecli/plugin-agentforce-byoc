/*
 * Copy the bundled Agentforce BYOC runtime (shipped in the plugin's assets/)
 * into a scaffolded project, so the deployed package can `import agentforce_byoc`
 * in the sandbox. Interim until the SDK is on a public index, at which point the
 * scaffold declares it as a dependency instead and this step is dropped.
 */

import { cp, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Compiled layout: lib/lib/vendorSdk.js -> package root is two levels up.
function pluginRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

export function vendoredSdkSource(): string {
  return path.join(pluginRoot(), 'assets', 'agentforce_byoc');
}

/** Copy the bundled runtime into `<projectDir>/agentforce_byoc`. */
export async function vendorSdk(projectDir: string): Promise<string> {
  const src = vendoredSdkSource();
  try {
    await access(src);
  } catch {
    throw new Error(`Bundled SDK runtime not found at ${src}. The plugin build may be incomplete.`);
  }
  const dest = path.join(projectDir, 'agentforce_byoc');
  await cp(src, dest, { recursive: true });
  return dest;
}
