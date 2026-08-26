/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * HTTP client for the Agentforce BYOC deploy/upload API. Request shapes match
 * the Agentforce BYOC service contract:
 *
 *   1. POST <base>/byoc/upload/request  -> register metadata + presigned S3 URL
 *   2. PUT  <presigned-url>             -> upload the .tar.gz
 *   3. GET  <base>/byoc/upload/status   -> read registration + upload status
 *
 * Registration is folded into step 1: the metadata row is written when the
 * presigned URL is minted, so there is no separate "report status" write. Step
 * 3 is read-only and safe to poll (it never 404s).
 *
 * Auth is `Authorization: Bearer <orgJwt>` + the `x-sfdc-core-tenant-id` header,
 * plus `x-sfdc-app-context` (required for SFAP tenant-aware routing on the public
 * paths).
 */

import { readFile } from 'node:fs/promises';

// The service signs the presigned URL with ContentType "application/gzip"; the
// PUT must send exactly this or S3 rejects the signature.
const PACKAGE_CONTENT_TYPE = 'application/gzip';
const DEPLOY_TIMEOUT_MS = 120_000;

export type UploadRequestResult = {
  uploadUrl: string;
  s3Key: string;
  tenantId?: string;
  packageName?: string;
  version?: string;
  uploadTime?: number;
  packageSize?: number;
  entryPoints?: string[];
  maxLiveDurationS?: number;
  status?: string;
  [key: string]: unknown;
};

export type UploadStatusResult = {
  tenantId?: string;
  packageName?: string;
  version?: string;
  s3Key?: string;
  registrationStatus?: string;
  uploadStatus?: string;
  [key: string]: unknown;
};

async function postJson<T>(
  url: string,
  body: unknown,
  orgJwt: string,
  tenantId: string,
  extraHeaders?: { appContext?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${orgJwt}`,
    'x-sfdc-core-tenant-id': tenantId,
  };
  if (extraHeaders?.appContext) {
    headers['x-sfdc-app-context'] = extraHeaders.appContext;
  }
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`BYOC API call to ${url} failed with status ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`BYOC API at ${url} returned a non-JSON response: ${JSON.stringify(text)}`);
  }
}

/** Step 1: register package metadata and get a presigned S3 upload URL in one call. */
export function requestUploadAndRegister(
  baseUrl: string,
  tenantId: string,
  orgJwt: string,
  args: {
    packageName: string;
    version: string;
    packageSize: number;
    entryPoints: string[];
    maxLiveDurationS: number;
    appContext: string;
  }
): Promise<UploadRequestResult> {
  return postJson<UploadRequestResult>(
    `${baseUrl}/byoc/upload/request`,
    {
      packageName: args.packageName,
      version: args.version,
      packageSize: args.packageSize,
      entryPoints: args.entryPoints,
      maxLiveDurationS: args.maxLiveDurationS,
    },
    orgJwt,
    tenantId,
    { appContext: args.appContext }
  );
}

/** Step 2: upload the archive to the presigned URL. The URL carries its own signature — no auth header. */
export async function uploadPackage(uploadUrl: string, filePath: string): Promise<void> {
  const data = await readFile(filePath);
  const res = await fetchWithTimeout(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': PACKAGE_CONTENT_TYPE },
    // Node's fetch accepts a Buffer/Uint8Array at runtime; the cast avoids the
    // over-strict ArrayBufferLike-vs-ArrayBuffer mismatch in the DOM typings.
    body: data as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload to presigned URL failed with status ${res.status}: ${text}`);
  }
}

/**
 * Read-only deploy status: reports registration status (metadata row) and
 * upload status (S3 object present) independently. Never 404s, so it is safe
 * to poll during the two-phase upload.
 */
export function getUploadStatus(
  baseUrl: string,
  tenantId: string,
  orgJwt: string,
  packageName: string,
  version: string,
  appContext: string
): Promise<UploadStatusResult> {
  const url = `${baseUrl}/byoc/upload/status?packageName=${encodeURIComponent(
    packageName
  )}&version=${encodeURIComponent(version)}`;
  return getJson<UploadStatusResult>(url, orgJwt, tenantId, { appContext });
}

async function getJson<T>(
  url: string,
  orgJwt: string,
  tenantId: string,
  extraHeaders?: { appContext?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${orgJwt}`,
    'x-sfdc-core-tenant-id': tenantId,
  };
  if (extraHeaders?.appContext) {
    headers['x-sfdc-app-context'] = extraHeaders.appContext;
  }
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`BYOC API call to ${url} failed with status ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`BYOC API at ${url} returned a non-JSON response: ${JSON.stringify(text)}`);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEPLOY_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    throw new Error(`Request to ${url} failed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
