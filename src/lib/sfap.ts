/*
 * SFAP base-URL resolution.
 *
 * The BYOC service is reached through the production SFAP edge
 * (api.salesforce.com) by default. Internal developers targeting a
 * pre-production environment override the host with the BYOC_PROXY_URL
 * environment variable. The tenant id still identifies the org — it is sent as
 * the x-sfdc-core-tenant-id header and carried in the OrgJWT `tnk` claim — but
 * it no longer selects the host. Kept in sync with the Agentforce BYOC Python
 * SDK (agentforce_byoc.gateway.relay_client.resolve_sfap_base_url).
 */

// Base URL used when BYOC_PROXY_URL is not set. Production is the only public
// environment; internal developers point BYOC_PROXY_URL at a pre-production host.
const DEFAULT_SFAP_BASE_URL = 'https://api.salesforce.com';

/**
 * Resolve the SFAP base URL.
 *
 * Precedence: the `BYOC_PROXY_URL` environment variable (used verbatim, minus
 * any trailing slash) → the production default. The tenant id is validated for
 * shape (`core/<instance>-<fd>/<org-id>`) because it is a required request
 * header, but it does not select the host.
 */
export function resolveSfapBaseUrl(tenantId: string): string {
  const override = process.env.BYOC_PROXY_URL?.trim();
  if (override) {
    return override.replace(/\/+$/, '');
  }

  if (!tenantId) {
    throw new Error(`Invalid tenant id: ${JSON.stringify(tenantId)}`);
  }

  const parts = tenantId.split('/');
  if (parts.length !== 3 || parts[0] !== 'core' || !parts[1] || !parts[2]) {
    throw new Error(
      `Malformed tenant id ${JSON.stringify(tenantId)}; expected 'core/<instance>-<fd>/<org-id>'.`
    );
  }

  return DEFAULT_SFAP_BASE_URL;
}
