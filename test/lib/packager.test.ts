import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { list } from 'tar';
import { buildPackage } from '../../lib/lib/packager.js';

describe('buildPackage', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'byoc-pkg-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeProject(): Promise<void> {
    await writeFile(path.join(dir, 'main.py'), 'def function(r): return r');
    await writeFile(path.join(dir, 'config.json'), '{"entryPoint":"main.py"}');
    await writeFile(path.join(dir, 'pyproject.toml'), '[tool.poetry]\nname="x"');
    await mkdir(path.join(dir, 'agentforce_byoc'), { recursive: true });
    await writeFile(path.join(dir, 'agentforce_byoc', '__init__.py'), '');
  }

  it('builds a tar.gz that includes the function files and vendored runtime', async () => {
    await writeProject();
    const out = path.join(dir, 'x-1.0.tar.gz');
    const result = await buildPackage(dir, 'x', '1.0', out);
    expect(result.archivePath).to.equal(out);
    expect(result.sizeBytes).to.be.greaterThan(0);

    const entries: string[] = [];
    await list({ file: out, onentry: (e) => entries.push(e.path) });
    expect(entries).to.include('main.py');
    expect(entries).to.include('config.json');
    expect(entries.some((e) => e.startsWith('agentforce_byoc/'))).to.equal(true);
  });

  it('throws when config.json is missing', async () => {
    await writeFile(path.join(dir, 'main.py'), 'x');
    await expect(buildPackage(dir, 'x', '1.0')).to.be.rejectedWith(/config.json not found/);
  });
});
