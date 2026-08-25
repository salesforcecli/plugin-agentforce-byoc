# @salesforce/plugin-agentforce-byoc

Salesforce CLI plugin for **Agentforce BYOC** (Bring Your Own Code). Take a Python
function from `main.py` → packaged → deployed → invoked → registered as a
discoverable Agentforce action, all from one CLI.

> **Status: early / incubating.** Run it from a local build until it's published
> to npm.

---

## Install

```bash
git clone https://github.com/salesforcecli/plugin-agentforce-byoc.git
cd plugin-agentforce-byoc
npm install && npm run build
sf plugins link .     # or run any command via: node bin/run.js agentforce-byoc <cmd>
```

Prereqs: **`sf` CLI**, **Node 20+**, and (only for `register`) **Python 3.11+ with PyYAML**.

---

## Quickstart — full E2E, copy-paste

Set your two auth values once (see [Auth](#auth) for where to get them):

```bash
export ORG_JWT_TOKEN=<org-jwt>                     # sfap_api-scoped OrgJWT
export TENANT_ID=core/falcondeva/00Dfi100001ftjHEAQ  # your tenant (instance picks the SFAP host)
```

Then this whole block runs as-is — no org login, no `--target-org` needed:

```bash
sf agentforce-byoc init --name my-agent && cd my-agent
# ...edit main.py — your agent is `function(request) -> dict`...
sf agentforce-byoc package
sf agentforce-byoc deploy --package-name my-agent --package-file my-agent-1.0.tar.gz
sf agentforce-byoc invoke --package-name my-agent --user-id "$USER" \
  --input '{"text":"Say hello in one sentence."}'
```

That's the loop. Everything above is env-only — the interim auth reads
`ORG_JWT_TOKEN` / `TENANT_ID` directly, so no Salesforce org login is required.

**Async variant** (submit now, poll later):

```bash
sf agentforce-byoc invoke --package-name my-agent --user-id "$USER" --input '{...}' --async   # -> taskId
sf agentforce-byoc status --task-id <taskId> --wait                                            # polls to done
```

**Make it a discoverable action** (optional — needs a real logged-in org, since it
deploys metadata via `sf project deploy`):

```bash
sf org login web --alias my-org
sf agentforce-byoc register --namespace myOrg --package my-agent --target-org my-org
```

---

## Auth

The BYOC service is reached through Salesforce API Platform (SFAP), which needs an
**OrgJWT** bearer token (scope `sfap_api`) and the core tenant id. In-process
minting from a `--target-org` connection is the end state but isn't wired yet, so
the plugin reads both from the environment:

```bash
export ORG_JWT_TOKEN=<org-jwt>
export TENANT_ID=core/<instance>-<fd>/<org-id>
```

Obtain an OrgJWT scoped `sfap_api` for your tenant through your org's standard
token-issuance flow. `TENANT_ID` is the token's `tnk` claim; its instance
segment (`falcondev`, `falcondeva`, `falcontest1`, `falconstage`,
`falconperf2m`) selects the SFAP host automatically.

---

## Commands

| Command | Purpose | Auth |
|---|---|---|
| `init --name <name>` | Scaffold a project (you only edit `main.py`). | — |
| `validate` | Static checks on the project. | — |
| `package` | Build the deployable `.tar.gz`. | — |
| `deploy` | Register metadata **and** upload the archive (`POST /byoc/upload/request`). | env |
| `deploy-status` | Read-only registration + upload state (`GET /byoc/upload/status`). | env |
| `invoke` | Run a deployed package and print its output; `--async` returns a task id. | env |
| `status` | Fetch an `--async` task's status/result; `--wait` polls to completion. | env |
| `register` | Generate an OpenAPI spec from `main.py` and deploy it as a Code Extension ESR. | env + `--target-org` |

- **`env`** = `ORG_JWT_TOKEN` + `TENANT_ID`. `--target-org` is **optional** on these
  commands (it isn't used for credentials today); pass it only if you want `invoke`
  to default `--user-id` to the org username.
- **`invoke` needs a user id** (`x-sfdc-user-id`, the rate-limit/session subject):
  pass `--user-id`, or a `--target-org` whose username is used as the default.
- **`register` needs a real logged-in org** — it shells out to `sf project deploy`.

Every command takes `--help`.

### register (discoverable action)

`register` reads your `@entry_func` / `@requestSchema` / `@responseSchema`
annotations, generates an OpenAPI 3.0 spec, templates an
`ExternalServiceRegistration` (type `CodeExtension`), and deploys it with
`sf project deploy`. Use `--dry-run` to generate and inspect the metadata without
deploying.

```bash
sf agentforce-byoc register --namespace myOrg --package my-agent --dry-run --target-org my-org
```

- DeveloperName is derived from `--package` (`my-agent` → `my_agent`); override with `--registration-name`.
- **Needs Python 3 + PyYAML** on the PATH — the one command that shells out to the
  Python SDK. Point it at a specific interpreter with `--python /path/to/python`.

---

## Limitations

- **Einstein GPT.** A full LLM round-trip inside a function needs Einstein GPT
  enabled on the org (otherwise the relay returns `E30086`).
- **Interim auth.** `ORG_JWT_TOKEN` / `TENANT_ID` env vars stand in until
  in-process OAuth from `--target-org` lands; the flag is kept (optional) as the
  future hook.
- **`register` needs local Python.** The schema generator parses `main.py`'s AST in
  Python; a TS port (planned) will make the plugin fully hermetic.
- **`register` verified to the catalog only** — the ESR is queryable as a
  CodeExtension; surfacing it as an invocable Builder action isn't verified here.

---

## Development

```bash
npm install
npm run build      # compile + generate oclif.manifest.json
npm test           # mocha
npm run lint
```
