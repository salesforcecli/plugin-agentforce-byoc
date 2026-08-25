import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { expect } from 'chai';
import {
  firstOperationId,
  buildEsrMetaXml,
  writeEsrProject,
  generatorScriptPath,
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
