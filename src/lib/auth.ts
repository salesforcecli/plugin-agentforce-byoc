/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Auth bridge: turn a Salesforce CLI org connection into the credentials the
 * BYOC SFAP endpoints require — an OrgJWT bearer token and a core tenant id.
 *
 * Minting an `sfap_api`-scoped OrgJWT from the org session (via an External
 * Client App OAuth flow) is the pending design item; an opaque `sf` token is not
 * accepted by SFAP. Until that lands, the token and tenant id are taken from
 * ORG_JWT_TOKEN / TENANT_ID so the rest of the plugin can be built and tested.
 */

import { Org } from '@salesforce/core';

export type ByocAuth = {
  orgJwt: string;
  tenantId: string;
};

export async function resolveAuth(org?: Org): Promise<ByocAuth> {
  const tenantId = await resolveTenantId(org);
  const orgJwt = await resolveOrgJwt(org);
  return { orgJwt, tenantId };
}

async function resolveOrgJwt(_org?: Org): Promise<string> {
  const fromEnv = process.env.ORG_JWT_TOKEN;
  if (fromEnv) {
    return fromEnv;
  }
  throw new Error(
    'Could not obtain an OrgJWT. Set ORG_JWT_TOKEN for now; the External Client App ' +
      'OAuth flow that mints one from the org session is not yet implemented.'
  );
}

async function resolveTenantId(_org?: Org): Promise<string> {
  const fromEnv = process.env.TENANT_ID;
  if (fromEnv) {
    return fromEnv;
  }
  throw new Error(
    'Could not resolve the core tenant id. Set TENANT_ID=core/<instance>-<fd>/<org-id> for now; ' +
      'deriving it from the org is a pending item.'
  );
}
