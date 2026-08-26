/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Build a deployable .tar.gz for a BYOC project. Mirrors the Python SDK's
 * `agentforce zip`: includes the function files plus the vendored
 * `agentforce_byoc/` runtime, gzip-compressed (the upload contract expects
 * `application/gzip`).
 */

import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { create as tarCreate } from 'tar';

const REQUIRED_FILES = [
  'main.py',
  'entry_func.py',
  'schema.py',
  'config.json',
  'Dockerfile',
  'pyproject.toml',
  'requirements.txt',
  '.python-version',
];

const OPTIONAL_FILES = ['poetry.lock', '.dockerignore', 'README.md'];

export type PackageResult = {
  archivePath: string;
  sizeBytes: number;
};

export async function buildPackage(
  projectDir: string,
  name: string,
  version: string,
  output?: string
): Promise<PackageResult> {
  const root = path.resolve(projectDir);
  const archivePath = path.resolve(output ?? `${name}-${version}.tar.gz`);

  const entries: string[] = [];
  for (const f of [...REQUIRED_FILES, ...OPTIONAL_FILES]) {
    if (existsSync(path.join(root, f))) {
      entries.push(f);
    }
  }

  // Vendored SDK runtime (until the SDK is on a public index). Shipped so the
  // deployed package can `import agentforce_byoc` in the sandbox.
  if (existsSync(path.join(root, 'agentforce_byoc'))) {
    entries.push('agentforce_byoc');
  }

  if (!entries.includes('config.json')) {
    throw new Error("config.json not found — is this an Agentforce BYOC project? Run 'init' first.");
  }
  if (!entries.includes('main.py')) {
    throw new Error('main.py not found.');
  }

  await tarCreate(
    {
      gzip: true,
      file: archivePath,
      cwd: root,
      // Skip Python caches/compiled artifacts in the vendored SDK.
      filter: (p: string) => !p.includes('__pycache__') && !p.endsWith('.pyc'),
    },
    entries
  );

  const { size } = await stat(archivePath);
  return { archivePath, sizeBytes: size };
}
