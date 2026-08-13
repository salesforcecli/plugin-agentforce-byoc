import { expect } from 'chai';
import { resolveSfapBaseUrl } from '../../lib/lib/sfap.js';

describe('resolveSfapBaseUrl', () => {
  it('maps known instances to SFAP URLs', () => {
    expect(resolveSfapBaseUrl('core/falcondev-core4/00Dxx0000000000')).to.equal(
      'https://dev.api.salesforce.com'
    );
    expect(resolveSfapBaseUrl('core/prod/00Dxx0000000000')).to.equal('https://api.salesforce.com');
  });

  it('ignores the functional-domain suffix on the instance token', () => {
    expect(resolveSfapBaseUrl('core/falcontest1-einstein2/00Dxx')).to.equal(
      'https://test.api.salesforce.com'
    );
  });

  it('rejects a malformed tenant id', () => {
    expect(() => resolveSfapBaseUrl('not-a-tenant')).to.throw(/Malformed tenant id/);
    expect(() => resolveSfapBaseUrl('core//00Dxx')).to.throw(/Malformed tenant id/);
  });

  it('rejects an unknown instance', () => {
    expect(() => resolveSfapBaseUrl('core/unknowninst-fd/00Dxx')).to.throw(/Unknown instance/);
  });
});
