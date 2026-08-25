import { expect } from 'chai';
import { resolveSfapBaseUrl } from '../../lib/lib/sfap.js';

describe('resolveSfapBaseUrl', () => {
  const PROD = 'https://api.salesforce.com';
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.BYOC_PROXY_URL;
    delete process.env.BYOC_PROXY_URL;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.BYOC_PROXY_URL;
    } else {
      process.env.BYOC_PROXY_URL = saved;
    }
  });

  it('defaults to production for any well-formed tenant', () => {
    expect(resolveSfapBaseUrl('core/exampleInstance/00Dxx0000000000')).to.equal(PROD);
    expect(resolveSfapBaseUrl('core/prod/00Dxx0000000000')).to.equal(PROD);
    // An unknown but well-formed instance no longer throws; it resolves to prod.
    expect(resolveSfapBaseUrl('core/anyinstance-einstein2/00Dxx')).to.equal(PROD);
  });

  it('prefers BYOC_PROXY_URL over the default (and strips trailing slashes)', () => {
    process.env.BYOC_PROXY_URL = 'https://custom.proxy.example/';
    expect(resolveSfapBaseUrl('core/exampleInstance/00Dxx')).to.equal('https://custom.proxy.example');
  });

  it('rejects a malformed tenant id when no override is set', () => {
    expect(() => resolveSfapBaseUrl('not-a-tenant')).to.throw(/Malformed tenant id/);
    expect(() => resolveSfapBaseUrl('core//00Dxx')).to.throw(/Malformed tenant id/);
  });
});
