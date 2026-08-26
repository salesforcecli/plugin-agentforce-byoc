/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { access } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { readProjectConfig } from '../../lib/projectConfig.js';
import {
  generateOpenApiYaml,
  firstOperationId,
  writeEsrProject,
  runCommand,
} from '../../lib/register.js';

export type RegisterResult = {
  registrationName: string;
  operationId: string;
  deployed: boolean;
};

export default class Register extends SfCommand<RegisterResult> {
  public static readonly summary =
    'Register a BYOC function as a discoverable Code Extension action in the org.';
  public static readonly description =
    'Generates an OpenAPI 3.0 spec from the project entry point (main.py), templates an ' +
    'ExternalServiceRegistration (CodeExtension), and deploys it to the org with ' +
    '`sf project deploy`. The registered function becomes usable as an action in ' +
    'Prompt Builder / Agent Builder / Flow.\n\n' +
    'This step needs Python 3 with PyYAML on the PATH (it reads the function type ' +
    'annotations to build the schema).';
  public static readonly examples = [
    'sf agentforce-byoc register --namespace myOrg --package my-agent --target-org my-org',
  ];

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    namespace: Flags.string({
      summary: 'Function namespace (your org namespace).',
      required: true,
    }),
    package: Flags.string({
      char: 'p',
      summary: 'Function package name.',
      required: true,
    }),
    'project-dir': Flags.directory({
      char: 'd',
      summary: 'Project directory (default: current directory).',
      default: '.',
      exists: true,
    }),
    'registration-name': Flags.string({
      summary: 'ExternalServiceRegistration developer name (default: derived from --package).',
    }),
    python: Flags.string({
      summary: 'Python interpreter to run the schema generator (default: python3).',
      default: 'python3',
    }),
    'dry-run': Flags.boolean({
      summary: 'Generate and template the metadata but do not deploy to the org.',
      default: false,
    }),
  };

  public async run(): Promise<RegisterResult> {
    const { flags } = await this.parse(Register);
    const projectDir = flags['project-dir'];
    const registrationName = flags['registration-name'] ?? toDeveloperName(flags.package);

    const config = await readProjectConfig(projectDir);
    const entryPointPath = path.join(projectDir, config.entryPoint);
    try {
      await access(entryPointPath);
    } catch {
      throw new Error(`Entry point ${entryPointPath} not found (config.json entryPoint: ${config.entryPoint}).`);
    }

    this.spinner.start('Generating OpenAPI schema');
    const openApiYaml = await generateOpenApiYaml({
      entryPointPath,
      namespace: flags.namespace,
      packageName: flags.package,
      python: flags.python,
    });
    this.spinner.stop();

    const operationId = firstOperationId(openApiYaml);
    if (!operationId) {
      throw new Error('Generated schema has no operationId; is there an @entry_func in the entry point?');
    }

    const projectRoot = await writeEsrProject({ registrationName, openApiYaml, operationId });

    if (flags['dry-run']) {
      this.log(`Generated ExternalServiceRegistration '${registrationName}' (operation: ${operationId}).`);
      this.log(`  Metadata project: ${projectRoot}`);
      this.log('  --dry-run set; skipped deploy.');
      return { registrationName, operationId, deployed: false };
    }

    this.spinner.start(`Deploying ExternalServiceRegistration:${registrationName}`);
    const result = await runCommand(
      'sf',
      [
        'project',
        'deploy',
        'start',
        '--metadata',
        `ExternalServiceRegistration:${registrationName}`,
        '--target-org',
        flags['target-org'].getUsername() ?? '',
      ],
      projectRoot
    );
    this.spinner.stop();

    if (result.code !== 0) {
      throw new Error(`sf project deploy failed:\n${result.stderr || result.stdout}`);
    }

    this.log(`Registered '${registrationName}' (operation: ${operationId}) in the org.`);
    this.log('  It is now available as a Code Extension action in Prompt/Agent Builder / Flow.');

    return { registrationName, operationId, deployed: true };
  }
}

/** Derive a valid ESR developer name from a package name (alnum + underscores). */
function toDeveloperName(packageName: string): string {
  const cleaned = packageName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const withLeadingAlpha = /^[a-zA-Z]/.test(cleaned) ? cleaned : `x_${cleaned}`;
  return withLeadingAlpha || 'ByocFunction';
}
