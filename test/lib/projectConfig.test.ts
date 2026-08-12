import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { readProjectConfig } from '../../lib/lib/projectConfig.js';

describe('readProjectConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'byoc-cfg-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads entryPoint/name/version', async () => {
    await writeFile(
      path.join(dir, 'config.json'),
      JSON.stringify({ entryPoint: 'app.py', name: 'a', version: '2.0' })
    );
    const cfg = await readProjectConfig(dir);
    expect(cfg).to.deep.equal({ entryPoint: 'app.py', name: 'a', version: '2.0' });
  });

  it('defaults entryPoint to main.py when absent', async () => {
    await writeFile(path.join(dir, 'config.json'), JSON.stringify({}));
    expect((await readProjectConfig(dir)).entryPoint).to.equal('main.py');
  });

  it('throws a helpful error when config.json is missing', async () => {
    await expect(readProjectConfig(dir)).to.be.rejectedWith(/config.json not found/);
  });

  it('throws on invalid JSON', async () => {
    await writeFile(path.join(dir, 'config.json'), '{ not json');
    await expect(readProjectConfig(dir)).to.be.rejectedWith(/Invalid config.json/);
  });
});
