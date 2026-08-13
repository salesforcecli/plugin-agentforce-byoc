import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { resolveAuth } from '../../lib/auth.js';
import { resolveSfapBaseUrl } from '../../lib/sfap.js';
import { getInvokeStatus, type InvokeResult } from '../../lib/deployClient.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);

export default class Status extends SfCommand<InvokeResult> {
  public static readonly summary = 'Check the status and result of an async BYOC invocation.';
  public static readonly description =
    'Queries the execution status of a task submitted with `invoke --async`. ' +
    'With `--wait`, polls until the task reaches a terminal state.';
  public static readonly examples = [
    'sf agentforce-byoc status --task-id abc123 --target-org my-org',
    'sf agentforce-byoc status --task-id abc123 --wait --target-org my-org',
  ];

  public static readonly flags = {
    'target-org': Flags.optionalOrg(),
    'task-id': Flags.string({
      char: 't',
      summary: 'Task id returned by `invoke --async`.',
      required: true,
    }),
    wait: Flags.boolean({
      summary: 'Poll until the task reaches a terminal state.',
      default: false,
    }),
    'poll-interval': Flags.integer({
      summary: 'Seconds between polls when --wait is set (default: 3).',
      default: 3,
    }),
    'timeout': Flags.integer({
      summary: 'Max seconds to wait when --wait is set (default: 300).',
      default: 300,
    }),
  };

  public async run(): Promise<InvokeResult> {
    const { flags } = await this.parse(Status);
    const taskId = flags['task-id'];

    const { orgJwt, tenantId } = await resolveAuth(flags['target-org']);
    const baseUrl = resolveSfapBaseUrl(tenantId);

    let result = await getInvokeStatus(baseUrl, tenantId, orgJwt, taskId);

    if (flags.wait && !this.isTerminal(result)) {
      const deadline = Date.now() + flags.timeout * 1000;
      this.spinner.start(`Waiting for task ${taskId}`);
      while (!this.isTerminal(result) && Date.now() < deadline) {
        await sleep(flags['poll-interval'] * 1000);
        result = await getInvokeStatus(baseUrl, tenantId, orgJwt, taskId);
      }
      this.spinner.stop();
      if (!this.isTerminal(result)) {
        this.warn(`Timed out after ${flags.timeout}s; task is still ${result.status ?? 'unknown'}.`);
      }
    }

    this.log(`status: ${result.status ?? 'unknown'} (exitCode: ${result.exitCode ?? 'n/a'})`);
    if (result.output) {
      this.log(result.output);
    }
    if (result.stderr) {
      this.warn(result.stderr);
    }
    if (result.error) {
      this.warn(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
    }
    return result;
  }

  private isTerminal(result: InvokeResult): boolean {
    return result.status != null && TERMINAL_STATUSES.has(result.status);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
