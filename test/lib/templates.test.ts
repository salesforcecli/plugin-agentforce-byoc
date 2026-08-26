/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from 'chai';
import { renderScaffold } from '../../lib/lib/templates.js';

describe('renderScaffold', () => {
  it('produces the expected scaffold files', () => {
    const paths = renderScaffold('my-agent').map((f) => f.path);
    expect(paths).to.include.members([
      'main.py',
      'config.json',
      'pyproject.toml',
      '.python-version',
      'README.md',
      '.gitignore',
    ]);
  });

  it('substitutes the project name', () => {
    const files = renderScaffold('my-agent');
    const pyproject = files.find((f) => f.path === 'pyproject.toml');
    expect(pyproject?.content).to.contain('name = "my-agent"');
    expect(files.some((f) => f.content.includes('{{projectName}}'))).to.equal(false);
  });

  it('config.json declares the entry point', () => {
    const config = renderScaffold('x').find((f) => f.path === 'config.json');
    expect(JSON.parse(config!.content)).to.deep.equal({ entryPoint: 'main.py' });
  });
});
