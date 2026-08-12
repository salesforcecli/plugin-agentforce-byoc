# CLAUDE.md

Guidance for working in this repo.

## What this is

A Salesforce CLI (`sf`) plugin for **Agentforce BYOC** — scaffold, package, and
deploy custom Python agents that run server-side in the Agentforce BYOC service
(`ai-byoc-proxy`, fronted by SFAP). Pure TypeScript, built on `oclif` /
`@salesforce/sf-plugins-core`.

This is the **client/tooling** layer. It does not run agents locally and contains
no Python — the agent runtime is the separate `agentforce-byoc-python-sdk`.

## Architecture

- `src/commands/agentforce-byoc/*` — one file per command (`init`, `validate`,
  `package`, `deploy`, `deploy-status`, `invoke`). Thin; logic lives in `src/lib`.
- `src/lib/sfap.ts` — tenant-id → SFAP base URL. Port of the SDK's
  `resolve_sfap_base_url`; keep the instance map in sync with the SDK.
- `src/lib/deployClient.ts` — the BYOC REST calls (`/byoc/upload`,
  `/byoc/upload/status`, `/byoc/invoke/run/package/{name}`). Request shapes mirror
  the SDK's `deploy_client.py`.
- `src/lib/auth.ts` — resolves the OrgJWT + tenant id for authenticated commands.
- `src/lib/packager.ts` — builds the `.tar.gz`.
- `src/lib/templates.ts` — `init` scaffold, shipped as TS assets.

## Conventions

- **Pure TypeScript, hermetic.** No subprocess execution of other languages, no
  post-install hooks, no installing dependencies at runtime. This is required for
  eventual official hosting.
- **Auth stays in process.** The OrgJWT lives in memory and is never written to
  the shell, passed as a subprocess argument, or exported to the environment.
- **Match the SDK contracts.** When the proxy API or the SDK changes a request
  shape, update `deployClient.ts` / `sfap.ts` to match — they are deliberate ports.
- Keep comments sparse — explain non-obvious *why*, not the code.

## Known open items

- **OrgJWT acquisition:** auth-bearing commands currently read `ORG_JWT_TOKEN` /
  `TENANT_ID` from the environment. The intended design mints an `sfap_api`-scoped
  OrgJWT in process from the `--target-org` connection via an External Client App
  OAuth flow; that flow is not yet implemented (the one real unknown). An opaque
  `sf` access token is not accepted by SFAP.
- **`run` (local execution)** is intentionally not implemented.
- **Runtime distribution:** the Python SDK is vendored into projects until it is
  published to a public index.

## Build / test

```bash
npm install
npm run build      # tsc + oclif manifest
npm test           # mocha unit tests
```

Tests import from compiled `lib/`, so run `build` before `test`.
