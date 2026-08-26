/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { renderScaffold } from '../../lib/templates.js';
import { vendorSdk } from '../../lib/vendorSdk.js';

export type InitResult = {
  projectDir: string;
  filesCreated: string[];
};

const PROJECT_NAME_RE = /^[a-z][a-z0-9_-]*$/;

export default class Init extends SfCommand<InitResult> {
  public static readonly summary = 'Scaffold a new Agentforce BYOC project.';
  public static readonly description =
    'Creates a project directory with a starter agent (main.py), config, and metadata.';
  public static readonly examples = ['sf agentforce-byoc init --name my-agent'];

  public static readonly args = {};
  public static readonly strict = false;

  public static readonly flags = {
    name: Flags.string({
      char: 'n',
      summary: 'Project name (also the directory created). Lowercase, alphanumeric, - and _.',
      required: true,
    }),
  };

  public async run(): Promise<InitResult> {
    const { flags } = await this.parse(Init);
    const projectName = flags.name;

    if (!PROJECT_NAME_RE.test(projectName)) {
      throw new Error(
        `Invalid project name '${projectName}'. Use lowercase letters, digits, '-' and '_', starting with a letter.`
      );
    }

    const projectDir = path.resolve(projectName);
    await mkdir(projectDir, { recursive: true });

    const files = renderScaffold(projectName);
    const filesCreated: string[] = [];
    for (const f of files) {
      const out = path.join(projectDir, f.path);
      await writeFile(out, f.content, 'utf8');
      filesCreated.push(f.path);
    }

    await vendorSdk(projectDir);
    filesCreated.push('agentforce_byoc/');

    this.log(`Created Agentforce BYOC project '${projectName}'`);
    for (const f of filesCreated.sort()) {
      this.log(`  + ${f}`);
    }
    this.log('\nNext: edit main.py, then run `sf agentforce-byoc package`.');

    return { projectDir, filesCreated };
  }
}
