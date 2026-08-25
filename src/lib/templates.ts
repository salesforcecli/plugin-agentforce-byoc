/*
 * Project scaffold templates for `init`, shipped as plugin assets (pure TS, no
 * Python at install time). `{{projectName}}` is substituted at scaffold time.
 *
 * The runtime contract (entry_func / schema decorators, the function shape) is
 * kept in sync with the Agentforce BYOC Python SDK templates. When the SDK is
 * published to a public index, the vendored copy is replaced by a declared
 * dependency and the entry_func/schema stubs are dropped.
 */

export type TemplateFile = { path: string; content: string };

const MAIN_PY = `"""{{projectName}} - Agentforce BYOC Agent."""

from typing import TypedDict

from agentforce_byoc import get_client, get_logger
from agentforce_byoc.schema_utils import entry_func, requestSchema, responseSchema

logger = get_logger(__name__)


class ExampleRequest(TypedDict):
    """Request schema - define your input fields here."""

    text: str


class ExampleResponse(TypedDict):
    """Response schema - define your output fields here."""

    result: str
    status: str


@entry_func
@requestSchema(ExampleRequest)
@responseSchema(ExampleResponse)
def function(request: dict) -> dict:
    """Entry point called by the Agentforce BYOC runtime."""
    text = request.get("text", "")
    if not text:
        logger.warning("Missing 'text' field in request")
        return {"result": "", "status": "error"}

    client = get_client()
    relay_response = client.call_llm_chat_generations(
        parameter={
            "messages": [{"role": "user", "content": text}],
            "generation_settings": {"max_tokens": 50},
            "model": "llmgateway__EinsteinLlama4Maverick",
        },
    )
    return {"result": str(relay_response), "status": "success"}


# Invoked by the BYOC runtime: it injects \`byoc_input\` and runs this module.
# The return value must be emitted on a \`result:\` line for the runtime to
# capture it into the invoke response.
import json as _json

_response = function(byoc_input)
print("result:", _json.dumps(_response))
`;

const CONFIG_JSON = `{
  "entryPoint": "main.py"
}
`;

const PYPROJECT_TOML = `[tool.poetry]
name = "{{projectName}}"
version = "0.1.0"
description = "Agentforce BYOC Agent"
authors = ["Your Name <you@example.com>"]
readme = "README.md"
packages = [{include = "main.py"}]

[tool.poetry.dependencies]
python = "^3.11"
# The SDK is vendored into this project (the agentforce_byoc/ directory) until
# it is published to a public index, at which point declare it here instead:
# agentforce-byoc = "^0.1.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
`;

const PYTHON_VERSION = '3.11\n';

const README_MD = `# {{projectName}}

An Agentforce BYOC (Bring Your Own Code) agent.

## Develop

Edit \`main.py\` — your agent is the \`function(request) -> dict\`.

## Package and deploy

\`\`\`bash
sf agentforce-byoc package
sf agentforce-byoc deploy --package-name {{projectName}} --package-file {{projectName}}-1.0.tar.gz
sf agentforce-byoc deploy-status --package-name {{projectName}}
\`\`\`
`;

const GITIGNORE = `__pycache__/
*.pyc
dist/
*.tar.gz
`;

const TEMPLATES: TemplateFile[] = [
  { path: 'main.py', content: MAIN_PY },
  { path: 'config.json', content: CONFIG_JSON },
  { path: 'pyproject.toml', content: PYPROJECT_TOML },
  { path: '.python-version', content: PYTHON_VERSION },
  { path: 'README.md', content: README_MD },
  { path: '.gitignore', content: GITIGNORE },
];

/** Render the scaffold for a project, substituting `{{projectName}}`. */
export function renderScaffold(projectName: string): TemplateFile[] {
  return TEMPLATES.map((t) => ({
    path: t.path,
    content: t.content.replaceAll('{{projectName}}', projectName),
  }));
}
