/*
 * Copyright (c) 2026, Salesforce, Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import {
  firstOperationId,
  buildEsrMetaXml,
  writeEsrProject,
  generatorScriptPath,
  generateOpenApiYaml,
} from '../../lib/lib/register.js';

const SAMPLE_OPENAPI = `openapi: 3.0.0
info:
  title: Add Service
paths:
  /add:
    post:
      summary: Add two integers
      operationId: add
      x-sfdc:
        code-extension:
          feature: BYOC
`;

describe('firstOperationId', () => {
  it('extracts the first operationId from generated YAML', () => {
    expect(firstOperationId(SAMPLE_OPENAPI)).to.equal('add');
  });

  it('returns undefined when no operationId is present', () => {
    expect(firstOperationId('openapi: 3.0.0\npaths: {}\n')).to.equal(undefined);
  });
});

describe('buildEsrMetaXml', () => {
  it('produces a CodeExtension ESR meta-xml with the schema file and operation', () => {
    const xml = buildEsrMetaXml({ schemaFileName: 'MyFunc.yaml', operationId: 'add' });
    expect(xml).to.contain('<schemaType>OpenApi3</schemaType>');
    expect(xml).to.contain('<registrationProviderType>CodeExtension</registrationProviderType>');
    expect(xml).to.contain('<schemaUploadFileName>MyFunc.yaml</schemaUploadFileName>');
    expect(xml).to.contain('<name>add</name>');
    expect(xml).to.contain('<active>true</active>');
  });
});

describe('writeEsrProject', () => {
  it('lays out an SFDX project with the schema, meta-xml, and sfdx-project.json', async () => {
    const root = await writeEsrProject({
      registrationName: 'MyFunc',
      openApiYaml: SAMPLE_OPENAPI,
      operationId: 'add',
    });

    const esrDir = path.join(root, 'force-app', 'main', 'default', 'externalServiceRegistration');
    const yaml = await readFile(path.join(esrDir, 'MyFunc.yaml'), 'utf8');
    const meta = await readFile(
      path.join(esrDir, 'MyFunc.externalServiceRegistration-meta.xml'),
      'utf8'
    );
    const project = JSON.parse(await readFile(path.join(root, 'sfdx-project.json'), 'utf8'));

    expect(yaml).to.equal(SAMPLE_OPENAPI);
    expect(meta).to.contain('<schemaUploadFileName>MyFunc.yaml</schemaUploadFileName>');
    expect(meta).to.contain('<name>add</name>');
    expect(project.sourceBehaviorOptions).to.deep.equal(['decomposeExternalServiceRegistrationBeta']);
    expect(project.packageDirectories[0].path).to.equal('force-app');
  });
});

describe('generatorScriptPath', () => {
  it('points at a vendored generator.py that exists', async () => {
    const p = generatorScriptPath();
    expect(p.endsWith(path.join('assets', 'agentforce_byoc', 'schema_utils', 'generator.py'))).to.equal(
      true
    );
    // The vendored file must actually be present for the register command to work.
    await access(p);
  });
});

const SAMPLE_MAIN_PY = `from typing import TypedDict
from agentforce_byoc.schema_utils import entry_func, requestSchema, responseSchema


class AddRequest(TypedDict):
    a: float
    b: float


class AddResponse(TypedDict):
    result: float


@entry_func
@requestSchema(AddRequest)
@responseSchema(AddResponse)
def addNumbers(request: dict) -> dict:
    """Add two numbers."""
    return {"result": request["a"] + request["b"]}
`;

describe('generateOpenApiYaml', () => {
  async function generate(successResponseKey?: string): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'byoc-gen-test-'));
    const entryPointPath = path.join(dir, 'main.py');
    await writeFile(entryPointPath, SAMPLE_MAIN_PY);
    return generateOpenApiYaml({
      entryPointPath,
      namespace: 'ns',
      packageName: 'pkg',
      python: 'python3',
      successResponseKey,
    });
  }

  it('wraps the result in the AI Gateway attributes.result envelope under 200', async () => {
    const yaml = await generate();
    expect(yaml).to.match(/'200':\n\s+description: Successful response/);
    expect(yaml).to.match(
      /schema:\n\s+type: object\n\s+properties:\n\s+attributes:\n\s+type: object\n\s+properties:\n\s+result:\n\s+\$ref: '#\/components\/schemas\/AddNumbersResult'/
    );
    expect(yaml).to.match(
      /components:\n\s+schemas:\n\s+AddNumbersResult:\n\s+type: object\n\s+properties:\n\s+result:\n\s+type: number/
    );
  });

  it('emits the result under the requested success response key', async () => {
    const yaml = await generate('default');
    expect(yaml).to.match(/\n\s+default:\n\s+description: Successful response/);
    expect(yaml).to.not.contain("'200':");
  });
});
