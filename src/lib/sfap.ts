/*
 * SFAP base-URL resolution. Ported from the Agentforce BYOC Python SDK
 * (agentforce_byoc.gateway.relay_client.resolve_sfap_base_url) to keep the
 * tenant-id -> endpoint mapping identical across the SDK and this plugin.
 */

// Instance token (before any "-<fd>" suffix) -> SFAP base URL.
const INSTANCE_URL_MAP: Record<string, string> = {
  falcondev: 'https://dev.api.salesforce.com',
  falcondeva: 'https://dev.api.salesforce.com',
  falcontest1: 'https://test.api.salesforce.com',
  falconstage: 'https://stage.api.salesforce.com',
  falconperf2m: 'https://perf.api.salesforce.com',
  prod: 'https://api.salesforce.com',
};

/**
 * Resolve the SFAP base URL from a core tenant id `core/<instance>-<fd>/<org-id>`.
 * Only the instance token (before any `-<fd>` suffix) selects the URL.
 */
export function resolveSfapBaseUrl(tenantId: string): string {
  if (!tenantId) {
    throw new Error(`Invalid tenant id: ${JSON.stringify(tenantId)}`);
  }

  const parts = tenantId.split('/');
  if (parts.length !== 3 || parts[0] !== 'core' || !parts[1] || !parts[2]) {
    throw new Error(
      `Malformed tenant id ${JSON.stringify(tenantId)}; expected 'core/<instance>-<fd>/<org-id>'.`
    );
  }

  const instanceToken = parts[1].split('-', 1)[0];
  const baseUrl = INSTANCE_URL_MAP[instanceToken];
  if (!baseUrl) {
    throw new Error(
      `Unknown instance ${JSON.stringify(instanceToken)} in tenant id ${JSON.stringify(tenantId)}; ` +
        `expected one of ${JSON.stringify(Object.keys(INSTANCE_URL_MAP).sort())}.`
    );
  }
  return baseUrl;
}
