import { readFile } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { resolveAuth } from '../../lib/auth.js';
import { resolveSfapBaseUrl } from '../../lib/sfap.js';
import { invokePackage, invokeStartPackage, type InvokeResult } from '../../lib/deployClient.js';

export default class Invoke extends SfCommand<InvokeResult> {
  public static readonly summary = 'Execute a deployed BYOC package remotely and return its output.';
  public static readonly description =
    'Runs a previously deployed package in the Agentforce BYOC sandbox and prints the result. ' +
    'Execution is remote, so no local Python is required.';
  public static readonly examples = [
    'sf agentforce-byoc invoke --package-name my-agent --target-org my-org',
    'sf agentforce-byoc invoke --package-name my-agent --input-file payload.json --target-org my-org',
    'sf agentforce-byoc invoke --package-name my-agent --async --target-org my-org',
  ];

  public static readonly flags = {
    'target-org': Flags.optionalOrg(),
    'package-name': Flags.string({
      char: 'n',
      summary: 'Name of the deployed package to invoke.',
      required: true,
    }),
    'package-version': Flags.string({
      summary: 'Package version (default: 1.0).',
      default: '1.0',
    }),
    input: Flags.string({
      char: 'i',
      summary: 'Inline JSON passed to the agent as its request (default: {}).',
    }),
    'input-file': Flags.file({
      summary: 'Path to a JSON file passed to the agent as its request.',
      exists: true,
    }),
    async: Flags.boolean({
      summary: 'Submit asynchronously and return a task id instead of waiting for the result.',
      default: false,
    }),
    'app-context': Flags.string({
      summary: 'Calling app label sent to the LLM Gateway (x-sfdc-app-context).',
      default: 'AgentforceBYOC',
    }),
    'user-id': Flags.string({
      summary:
        'Invoking user id (x-sfdc-user-id); the per-user rate-limit/session subject. Defaults to the --target-org username when provided.',
    }),
  };

  public async run(): Promise<InvokeResult> {
    const { flags } = await this.parse(Invoke);
    const packageName = flags['package-name'];

    const input = await this.resolveInput(flags.input, flags['input-file']);

    const { orgJwt, tenantId } = await resolveAuth(flags['target-org']);
    const baseUrl = resolveSfapBaseUrl(tenantId);

    const userId = flags['user-id'] ?? flags['target-org']?.getUsername();
    if (!userId) {
      throw new Error(
        'Could not determine the invoking user id. Pass --user-id explicitly ' +
          '(or --target-org with a resolvable username).'
      );
    }

    if (flags.async) {
      this.spinner.start(`Submitting ${packageName}`);
      const { taskId } = await invokeStartPackage(
        baseUrl,
        tenantId,
        orgJwt,
        packageName,
        input,
        flags['package-version'],
        flags['app-context'],
        userId
      );
      this.spinner.stop();
      this.log(`taskId: ${taskId}`);
      this.log(`Poll for the result with: sf agentforce-byoc status --task-id ${taskId} --target-org <org>`);
      return { taskId, status: 'submitted' };
    }

    this.spinner.start(`Invoking ${packageName}`);
    const result = await invokePackage(
      baseUrl,
      tenantId,
      orgJwt,
      packageName,
      input,
      flags['package-version'],
      flags['app-context'],
      userId
    );
    this.spinner.stop();

    this.log(`status: ${result.status ?? 'unknown'} (exitCode: ${result.exitCode ?? 'n/a'})`);
    if (result.output) {
      this.log(result.output);
    }
    if (result.stderr) {
      this.warn(result.stderr);
    }
    return result;
  }

  private async resolveInput(
    inline: string | undefined,
    file: string | undefined
  ): Promise<Record<string, unknown>> {
    if (inline && file) {
      throw new Error('Pass only one of --input or --input-file.');
    }
    const raw = file ? await readFile(file, 'utf8') : inline;
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      throw new Error(`Invalid JSON input: ${(e as Error).message}`);
    }
  }
}
