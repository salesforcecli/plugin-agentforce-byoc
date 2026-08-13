"""Agentforce Relay gateway client."""

import json
import os
from typing import Any, Dict

from agentforce_byoc import _http
from agentforce_byoc.gateway.base import BaseRelayGatewayClient
from agentforce_byoc.logging import get_logger

logger = get_logger(__name__)

# Environment variable carrying the org JWT, injected into the AgentCore
# sandbox by ai-byoc-proxy (see interpreter_service.py).
ORG_JWT_ENV_VAR = "ORG_JWT_TOKEN"

# Environment variable carrying the originating invoke's app context, injected
# into the sandbox by ai-byoc-proxy (session_manager._IDENTITY_ENV_MAP). The
# Relay API requires the x-sfdc-app-context header (400 header_invalid if
# missing); we forward this value verbatim.
APP_CONTEXT_ENV_VAR = "SFDC_APP_CONTEXT"

# Relay function identifiers understood by the Relay API (ai-byoc-proxy
# relay_service._ENDPOINT_MAP).
RELAY_FUNCTION_LLM = "llm"
RELAY_FUNCTION_LLM_CHAT = "llm_chat"

# Maps the Falcon instance token (the part of the tenant id before any
# ``-<fd>`` suffix) to its SFAP base URL. The FD segment is not used.
_INSTANCE_URL_MAP: Dict[str, str] = {
    "falcondev": "https://dev.api.salesforce.com",
    "falcondeva": "https://dev.api.salesforce.com",
    "falcontest1": "https://test.api.salesforce.com",
    "falconstage": "https://stage.api.salesforce.com",
    "falconperf2m": "https://perf.api.salesforce.com",
    "prod": "https://api.salesforce.com",
}

# Relay timeout (seconds) for the outbound POST.
_RELAY_TIMEOUT_S = 60


def resolve_sfap_base_url(tenant_id: str) -> str:
    """
    Resolve the SFAP base URL from a core tenant id.

    Tenant ids follow ``core/<instance>[-<fd>]/<org-id>`` (e.g.
    ``core/falcondev-core4/00Dxx...``). Only the instance token (before any
    ``-<fd>`` suffix) determines the URL; the FD segment is ignored.

    Args:
        tenant_id: The core tenant id.

    Returns:
        The SFAP base URL (no trailing slash).

    Raises:
        ValueError: If the tenant id is malformed or its instance does not
            map to a known SFAP environment.
    """
    if not tenant_id or not isinstance(tenant_id, str):
        raise ValueError(f"Invalid tenant id: {tenant_id!r}")

    parts = tenant_id.split("/")
    if len(parts) != 3 or parts[0] != "core" or not parts[1] or not parts[2]:
        raise ValueError(
            f"Malformed tenant id {tenant_id!r}; expected " "'core/<instance>-<fd>/<org-id>'."
        )

    instance_token = parts[1].split("-", 1)[0]
    base_url = _INSTANCE_URL_MAP.get(instance_token)
    if base_url is None:
        raise ValueError(
            f"Unknown instance {instance_token!r} in tenant id {tenant_id!r}; "
            f"expected one of {sorted(_INSTANCE_URL_MAP)}."
        )
    return base_url


class AgentforceRelayGatewayClient(BaseRelayGatewayClient):
    """
    Relay gateway client for the Agentforce BYOC runtime.

    Used when running inside AWS AgentCore. The org JWT is read from the
    ``ORG_JWT_TOKEN`` environment variable injected into the sandbox. The
    SFAP base URL is derived from the per-call ``tenant_id``; the Relay API
    endpoint is ``<sfap_base_url>/byoc/service``.

    This is the single shared client for all Relay functions. To add a new
    relay function, add a thin method that calls :meth:`_relay` with the
    function name (and a constant for it above).
    """

    def call_llm_generations(self, tenant_id: str, parameter: Dict[str, Any]) -> Dict[str, Any]:
        return self._relay(RELAY_FUNCTION_LLM, tenant_id, parameter)

    def call_llm_chat_generations(
        self, tenant_id: str, parameter: Dict[str, Any]
    ) -> Dict[str, Any]:
        return self._relay(RELAY_FUNCTION_LLM_CHAT, tenant_id, parameter)

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    def _get_org_jwt(self) -> str:
        """
        Resolve the org JWT.

        Reads ``ORG_JWT_TOKEN`` from the environment (injected by AgentCore).

        Raises:
            RuntimeError: If the variable is not set.
        """
        org_jwt = os.getenv(ORG_JWT_ENV_VAR)
        if not org_jwt:
            raise RuntimeError(
                f"{ORG_JWT_ENV_VAR} environment variable is not set. "
                "It is injected by the Agentforce runtime; for local testing "
                f"export {ORG_JWT_ENV_VAR}."
            )
        return org_jwt

    def _build_request_body(self, function: str, parameter: Dict[str, Any]) -> Dict[str, Any]:
        """
        Construct the Relay request body.

        The Relay API (``RelayRequest``) accepts only ``function`` and
        ``parameter``. The tenant and org JWT travel as headers, not in the
        body (see :meth:`_post`).
        """
        return {
            "function": function,
            "parameter": parameter,
        }

    def _post(self, url: str, body: Dict[str, Any], tenant_id: str, org_jwt: str) -> Dict[str, Any]:
        """
        POST a JSON body to ``url`` and return the parsed JSON response.

        Sends the org JWT as a bearer token, the tenant id as the
        ``x-sfdc-core-tenant-id`` header, and the app context as the
        ``x-sfdc-app-context`` header (SFAP verifies the JWT; the proxy reads
        the tenant and app-context headers).

        Raises:
            RuntimeError: On transport error or non-JSON response.
        """
        # SFAP verifies the OrgJWT and derives the tenant; we also pass the
        # tenant header explicitly. A 400 "x-sfdc-core-tenant-id header is
        # required" comes from SFAP rejecting the JWT, not a missing header here.
        # x-sfdc-app-context is mandatory on the proxy relay endpoint (400
        # header_invalid without it); forward the injected value.
        app_context = os.getenv(APP_CONTEXT_ENV_VAR)
        if not app_context:
            raise RuntimeError(
                f"{APP_CONTEXT_ENV_VAR} environment variable is not set. "
                "It is injected by the Agentforce runtime; for local testing "
                f"export {APP_CONTEXT_ENV_VAR}."
            )
        headers = {
            "Authorization": f"Bearer {org_jwt}",
            "x-sfdc-core-tenant-id": tenant_id,
            "x-sfdc-app-context": app_context,
        }
        try:
            status, raw = _http.post_json(url, body, headers, timeout=_RELAY_TIMEOUT_S)
        except OSError as e:
            raise RuntimeError(f"Relay API call to {url} failed: {e}") from e

        if status >= 400:
            raise RuntimeError(f"Relay API call to {url} failed with status {status}: {raw}")

        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Relay API at {url} returned a non-JSON response: {raw!r}") from e

    def _relay(self, function: str, tenant_id: str, parameter: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve URL + JWT, build the body, and POST to the Relay API."""
        base_url = resolve_sfap_base_url(tenant_id)
        url = f"{base_url}/byoc/service"
        org_jwt = self._get_org_jwt()
        body = self._build_request_body(function, parameter)
        logger.info(
            "Relaying %s for tenant=%s to %s",
            function,
            tenant_id,
            url,
        )
        return self._post(url, body, tenant_id, org_jwt)
