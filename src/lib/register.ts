/*
 * Register a BYOC function as a discoverable Code Extension action in the org's
 * API catalog. Three steps:
 *
 *   1. Generate an OpenAPI 3.0 spec from the project's entry point (main.py) by
 *      running the vendored Python generator (agentforce_byoc.schema_utils).
 *   2. Lay out a throwaway SFDX project: the OpenAPI YAML + an
 *      ExternalServiceRegistration meta-xml + sfdx-project.json.
 *   3. Deploy it with `sf project deploy start --metadata ExternalServiceRegistration:<name>`.
 *
 * Step 1 needs Python 3 + PyYAML on the host — it is the one place the plugin
 * shells out to the Python SDK, because turning main.py's type annotations into
 * a schema is intrinsically a Python-AST operation. Steps 2-3 are pure TS + a
 * stock `sf` deploy.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Compiled layout: lib/lib/register.js -> package root is two levels up.
function pluginRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

/** Path to the vendored generator script (runnable standalone; needs only PyYAML). */
export function generatorScriptPath(): string {
  return path.join(pluginRoot(), 'assets', 'agentforce_byoc', 'schema_utils', 'generator.py');
}

export type RunResult = { code: number; stdout: string; stderr: string };

/** Run a command, capturing stdout/stderr. Never rejects on a non-zero exit. */
export function runCommand(command: string, args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (e) => reject(e));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/**
 * Generate the OpenAPI spec for `entryPointPath` and return it as a YAML string.
 * Shells out to the vendored Python generator. `python` is the interpreter to use.
 */
export async function generateOpenApiYaml(args: {
  entryPointPath: string;
  namespace: string;
  packageName: string;
  python: string;
}): Promise<string> {
  const { entryPointPath, namespace, packageName, python } = args;
  let result: RunResult;
  try {
    result = await runCommand(python, [
      generatorScriptPath(),
      entryPointPath,
      '--namespace',
      namespace,
      '--package',
      packageName,
    ]);
  } catch (e) {
    throw new Error(
      `Could not run the schema generator with '${python}'. ` +
        `The register step needs Python 3 with PyYAML installed. Underlying error: ${
          (e as Error).message
        }`
    );
  }
  if (result.code !== 0) {
    throw new Error(`Schema generation failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/** Extract the first operationId from a generated OpenAPI YAML (for the ESR operation name). */
export function firstOperationId(openApiYaml: string): string | undefined {
  const match = openApiYaml.match(/^\s*operationId:\s*(\S+)\s*$/m);
  return match?.[1];
}

/** Build the ExternalServiceRegistration meta-xml for a CodeExtension registration. */
export function buildEsrMetaXml(args: { schemaFileName: string; operationId: string }): string {
  const { schemaFileName, operationId } = args;
  return `<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>${args.operationId}</label>
    <schemaType>OpenApi3</schemaType>
    <registrationProviderType>CodeExtension</registrationProviderType>
    <status>Complete</status>
    <schemaUploadFileName>${schemaFileName}</schemaUploadFileName>
    <operations>
        <active>true</active>
        <name>${operationId}</name>
    </operations>
</ExternalServiceRegistration>
`;
}

const SFDX_PROJECT_JSON = JSON.stringify(
  {
    packageDirectories: [{ path: 'force-app', default: true }],
    sourceBehaviorOptions: ['decomposeExternalServiceRegistrationBeta'],
    namespace: '',
    sfdcLoginUrl: 'https://login.salesforce.com',
    sourceApiVersion: '62.0',
  },
  null,
  2
);

/**
 * Lay out a throwaway SFDX project containing the ESR metadata and return its
 * root directory. The OpenAPI YAML and its meta-xml go under
 * force-app/main/default/externalServiceRegistration/<name>.*.
 */
export async function writeEsrProject(args: {
  registrationName: string;
  openApiYaml: string;
  operationId: string;
}): Promise<string> {
  const { registrationName, openApiYaml, operationId } = args;
  const root = await mkdtemp(path.join(tmpdir(), 'byoc-esr-'));
  const esrDir = path.join(root, 'force-app', 'main', 'default', 'externalServiceRegistration');
  await mkdir(esrDir, { recursive: true });

  const schemaFileName = `${registrationName}.yaml`;
  await writeFile(path.join(esrDir, schemaFileName), openApiYaml);
  await writeFile(
    path.join(esrDir, `${registrationName}.externalServiceRegistration-meta.xml`),
    buildEsrMetaXml({ schemaFileName, operationId })
  );
  await writeFile(path.join(root, 'sfdx-project.json'), SFDX_PROJECT_JSON);

  return root;
}
