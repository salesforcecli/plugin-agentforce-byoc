import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { buildPackage } from '../../lib/packager.js';
import { readProjectConfig } from '../../lib/projectConfig.js';

export type PackageResult = {
  archivePath: string;
  sizeBytes: number;
};

export default class Package extends SfCommand<PackageResult> {
  public static readonly summary = 'Build a deployable .tar.gz archive of a BYOC project.';
  public static readonly examples = [
    'sf agentforce-byoc package',
    'sf agentforce-byoc package --project-dir ./my-agent --package-version 1.0',
  ];

  public static readonly flags = {
    'project-dir': Flags.directory({
      char: 'd',
      summary: 'Project directory (default: current directory).',
      default: '.',
      exists: true,
    }),
    'package-name': Flags.string({
      char: 'n',
      summary: 'Package name (default: the project directory name).',
    }),
    'package-version': Flags.string({
      summary: 'Package version (default: 1.0).',
      default: '1.0',
    }),
    output: Flags.string({
      char: 'o',
      summary: 'Output archive path (default: <name>-<version>.tar.gz).',
    }),
  };

  public async run(): Promise<PackageResult> {
    const { flags } = await this.parse(Package);
    const projectDir = path.resolve(flags['project-dir']);

    // config.json must exist (the entry point lives there); read for defaults.
    const config = await readProjectConfig(projectDir);
    const name = flags['package-name'] ?? config.name ?? path.basename(projectDir);
    const version = flags['package-version'] ?? config.version ?? '1.0';

    this.spinner.start(`Packaging ${name} v${version}`);
    const result = await buildPackage(projectDir, name, version, flags.output);
    this.spinner.stop();

    const sizeMb = (result.sizeBytes / (1024 * 1024)).toFixed(2);
    this.log(`Created ${result.archivePath} (${sizeMb} MB)`);
    this.log(`\nNext: sf agentforce-byoc deploy --package-name ${name} --package-file ${path.basename(result.archivePath)} --target-org <alias>`);

    return result;
  }
}
