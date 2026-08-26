/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { stat } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { resolveAuth } from '../../lib/auth.js';
import { resolveSfapBaseUrl } from '../../lib/sfap.js';
import { requestUploadAndRegister, uploadPackage } from '../../lib/deployClient.js';

export type DeployResult = {
  s3Key: string;
  packageName: string;
  version: string;
  status?: string;
};

export default class Deploy extends SfCommand<DeployResult> {
  public static readonly summary =
    'Upload a packaged BYOC agent to the Agentforce BYOC service and register its metadata.';
  public static readonly description =
    'Requests a presigned S3 URL from the BYOC service, uploads the package archive to it, ' +
    'and registers the package metadata (size, entry point, max live duration). ' +
    'Use `deploy-status` afterward to read back the deployment status.';
  public static readonly examples = [
    'sf agentforce-byoc deploy --package-name my-agent --package-file my-agent-1.0.tar.gz --target-org my-org',
  ];

  public static readonly flags = {
    'target-org': Flags.optionalOrg(),
    'package-name': Flags.string({
      char: 'n',
      summary: 'Package name.',
      required: true,
    }),
    'package-file': Flags.file({
      char: 'f',
      summary: 'Package archive produced by `package`.',
      required: true,
      exists: true,
    }),
    'package-version': Flags.string({
      summary: 'Package version (default: 1.0).',
      default: '1.0',
    }),
    'entry-point': Flags.string({
      char: 'e',
      summary: 'Function entry point (default: main.py).',
      default: 'main.py',
    }),
    'max-live-duration': Flags.integer({
      summary: 'Max live duration in seconds (default: 300).',
      default: 300,
    }),
    'app-context': Flags.string({
      summary: 'Calling app label sent to the BYOC service (x-sfdc-app-context); required for tenant-aware routing.',
      default: 'EinsteinGPT',
    }),
  };

  public async run(): Promise<DeployResult> {
    const { flags } = await this.parse(Deploy);
    const packageName = flags['package-name'];
    const packageFile = flags['package-file'];
    const version = flags['package-version'];

    const { orgJwt, tenantId } = await resolveAuth(flags['target-org']);
    const baseUrl = resolveSfapBaseUrl(tenantId);

    const { size } = await stat(packageFile);

    this.spinner.start(`Registering ${packageName} v${version}`);
    const registered = await requestUploadAndRegister(baseUrl, tenantId, orgJwt, {
      packageName,
      version,
      packageSize: size,
      entryPoints: [flags['entry-point']],
      maxLiveDurationS: flags['max-live-duration'],
      appContext: flags['app-context'],
    });
    this.spinner.stop();

    this.spinner.start(`Uploading ${packageName} v${version} (${size} bytes)`);
    await uploadPackage(registered.uploadUrl, packageFile);
    this.spinner.stop();

    this.log(`Deployed ${packageName} v${version} (s3Key: ${registered.s3Key})`);
    this.log(`\nNext: sf agentforce-byoc register --package ${packageName} --namespace <ns> --target-org <org>`);

    return { s3Key: registered.s3Key, packageName, version, status: registered.status };
  }
}
