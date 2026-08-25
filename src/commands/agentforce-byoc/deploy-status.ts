import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { resolveAuth } from '../../lib/auth.js';
import { resolveSfapBaseUrl } from '../../lib/sfap.js';
import { getUploadStatus } from '../../lib/deployClient.js';

export type DeployStatusResult = {
  packageName: string;
  version: string;
  registrationStatus: string;
  uploadStatus: string;
  s3Key?: string;
};

export default class DeployStatus extends SfCommand<DeployStatusResult> {
  public static readonly summary = 'Read the deployment status of a BYOC package.';
  public static readonly description =
    'Read-only. Reports whether the package metadata is registered and whether the ' +
    'archive has been uploaded to S3, independently.';
  public static readonly examples = [
    'sf agentforce-byoc deploy-status --package-name my-agent --target-org my-org',
  ];

  public static readonly flags = {
    'target-org': Flags.optionalOrg(),
    'package-name': Flags.string({
      char: 'n',
      summary: 'Package name.',
      required: true,
    }),
    'package-version': Flags.string({
      summary: 'Package version (default: 1.0).',
      default: '1.0',
    }),
    'app-context': Flags.string({
      summary: 'Calling app label sent to the BYOC service (x-sfdc-app-context); required for tenant-aware routing.',
      default: 'EinsteinGPT',
    }),
  };

  public async run(): Promise<DeployStatusResult> {
    const { flags } = await this.parse(DeployStatus);
    const packageName = flags['package-name'];
    const version = flags['package-version'];

    const { orgJwt, tenantId } = await resolveAuth(flags['target-org']);
    const baseUrl = resolveSfapBaseUrl(tenantId);

    this.spinner.start(`Checking ${packageName} v${version}`);
    const status = await getUploadStatus(baseUrl, tenantId, orgJwt, packageName, version, flags['app-context']);
    this.spinner.stop();

    const registrationStatus = status.registrationStatus ?? 'unknown';
    const uploadStatus = status.uploadStatus ?? 'unknown';

    this.log(`${packageName} v${version}`);
    this.log(`  registration: ${registrationStatus}`);
    this.log(`  upload:       ${uploadStatus}`);
    this.log(`  s3Key:        ${status.s3Key ?? 'n/a'}`);

    return {
      packageName,
      version,
      registrationStatus,
      uploadStatus,
      s3Key: status.s3Key,
    };
  }
}
