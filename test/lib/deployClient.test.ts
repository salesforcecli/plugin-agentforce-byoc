/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from 'chai';
import { requestUploadAndRegister, getUploadStatus } from '../../lib/lib/deployClient.js';

type FetchArgs = { url: string; init: RequestInit };

/** Replace global.fetch with a stub that records the call and returns `response`. */
function stubFetch(response: { status: number; body: unknown }): {
  calls: FetchArgs[];
  restore: () => void;
} {
  const calls: FetchArgs[] = [];
  const original = global.fetch;
  global.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.status < 400,
      status: response.status,
      text: async () => JSON.stringify(response.body),
    } as unknown as Response;
  }) as unknown as typeof global.fetch;
  return { calls, restore: () => (global.fetch = original) };
}

describe('requestUploadAndRegister', () => {
  it('POSTs metadata to /byoc/upload/request with auth headers and returns the presigned URL', async () => {
    const body = {
      uploadUrl: 'https://s3.example.com/presigned',
      s3Key: 'core/exampleInstance/00Dxx/my-agent/1.0/package.tar.gz',
      tenantId: 'core/exampleInstance/00Dxx',
      packageName: 'my-agent',
      version: '1.0',
      status: 'registered',
    };
    const stub = stubFetch({ status: 200, body });
    try {
      const result = await requestUploadAndRegister(
        'https://api.salesforce.com',
        'core/exampleInstance/00Dxx',
        'jwt-abc',
        {
          packageName: 'my-agent',
          version: '1.0',
          packageSize: 10240,
          entryPoints: ['main.py'],
          maxLiveDurationS: 300,
          appContext: 'AgentforceBYOC',
        }
      );
      expect(result).to.deep.equal(body);
      expect(stub.calls).to.have.length(1);
      const { url, init } = stub.calls[0];
      expect(url).to.equal('https://api.salesforce.com/byoc/upload/request');
      expect(init.method).to.equal('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).to.equal('Bearer jwt-abc');
      expect(headers['x-sfdc-core-tenant-id']).to.equal('core/exampleInstance/00Dxx');
      expect(headers['x-sfdc-app-context']).to.equal('AgentforceBYOC');
      expect(JSON.parse(init.body as string)).to.deep.equal({
        packageName: 'my-agent',
        version: '1.0',
        packageSize: 10240,
        entryPoints: ['main.py'],
        maxLiveDurationS: 300,
      });
    } finally {
      stub.restore();
    }
  });

  it('throws on a non-2xx response', async () => {
    const stub = stubFetch({ status: 400, body: { detail: 'bad size' } });
    try {
      await expect(
        requestUploadAndRegister('https://api.salesforce.com', 'core/exampleInstance/00D', 'j', {
          packageName: 'pkg',
          version: '1.0',
          packageSize: 1,
          entryPoints: ['main.py'],
          maxLiveDurationS: 300,
          appContext: 'AgentforceBYOC',
        })
      ).to.be.rejectedWith(/status 400/);
    } finally {
      stub.restore();
    }
  });
});

describe('getUploadStatus', () => {
  it('GETs /byoc/upload/status with query + auth + app-context headers and returns both statuses', async () => {
    const body = {
      tenantId: 'core/exampleInstance/00Dxx',
      packageName: 'my-agent',
      version: '1.0',
      s3Key: 'core/exampleInstance/00Dxx/my-agent/1.0/package.tar.gz',
      registrationStatus: 'registered',
      uploadStatus: 'uploaded',
    };
    const stub = stubFetch({ status: 200, body });
    try {
      const result = await getUploadStatus(
        'https://api.salesforce.com',
        'core/exampleInstance/00Dxx',
        'jwt-abc',
        'my-agent',
        '1.0',
        'EinsteinGPT'
      );
      expect(result).to.deep.equal(body);
      expect(stub.calls).to.have.length(1);
      const { url, init } = stub.calls[0];
      expect(url).to.equal(
        'https://api.salesforce.com/byoc/upload/status?packageName=my-agent&version=1.0'
      );
      expect(init.method).to.equal('GET');
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).to.equal('Bearer jwt-abc');
      expect(headers['x-sfdc-core-tenant-id']).to.equal('core/exampleInstance/00Dxx');
      expect(headers['x-sfdc-app-context']).to.equal('EinsteinGPT');
    } finally {
      stub.restore();
    }
  });

  it('url-encodes the package name and version', async () => {
    const stub = stubFetch({ status: 200, body: {} });
    try {
      await getUploadStatus('https://api.salesforce.com', 'core/exampleInstance/00D', 'j', 'a b', '1.0-beta+1', 'EinsteinGPT');
      expect(stub.calls[0].url).to.equal(
        'https://api.salesforce.com/byoc/upload/status?packageName=a%20b&version=1.0-beta%2B1'
      );
    } finally {
      stub.restore();
    }
  });

  it('throws on an error response (e.g. 500)', async () => {
    const stub = stubFetch({ status: 500, body: { detail: 'boom' } });
    try {
      await expect(
        getUploadStatus('https://api.salesforce.com', 'core/exampleInstance/00D', 'j', 'pkg', '1.0', 'EinsteinGPT')
      ).to.be.rejectedWith(/status 500/);
    } finally {
      stub.restore();
    }
  });
});
