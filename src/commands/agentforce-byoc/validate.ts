/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';

export type ValidateResult = {
  projectDir: string;
  ok: boolean;
};

const REQUIRED_FILES = ['main.py', 'config.json', 'pyproject.toml'];

export default class Validate extends SfCommand<ValidateResult> {
  public static readonly summary = 'Validate an Agentforce BYOC project before packaging.';
  public static readonly examples = ['sf agentforce-byoc validate', 'sf agentforce-byoc validate --project-dir ./my-agent'];

  public static readonly flags = {
    'project-dir': Flags.directory({
      char: 'd',
      summary: 'Project directory (default: current directory).',
      default: '.',
      exists: true,
    }),
  };

  public async run(): Promise<ValidateResult> {
    const { flags } = await this.parse(Validate);
    const projectDir = path.resolve(flags['project-dir']);

    const missing: string[] = [];
    for (const f of REQUIRED_FILES) {
      if (existsSync(path.join(projectDir, f))) {
        this.log(`  ok  ${f}`);
      } else {
        missing.push(f);
        this.log(`  --  ${f} (missing)`);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Validation failed; missing: ${missing.join(', ')}`);
    }

    this.log('\nValidation passed.');
    return { projectDir, ok: true };
  }
}
