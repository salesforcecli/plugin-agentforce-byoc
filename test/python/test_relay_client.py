"""Tests for the vendored agentforce_byoc.gateway.relay_client.

Uses stdlib-only unittest, mirroring _http.py's "stdlib only, nothing extra
bundled" philosophy. Run with:

    python3 -m unittest discover -s test/python -v

Mocks agentforce_byoc._http.post_json (the transport boundary), not
relay_client._post itself, so header-assembly logic is exercised for real.
"""

import json
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "assets"))

from agentforce_byoc import _http  # noqa: E402
from agentforce_byoc.gateway.relay_client import (  # noqa: E402
    APP_CONTEXT_ENV_VAR,
    CORE_TENANT_ID_ENV_VAR,
    ORG_JWT_ENV_VAR,
    USER_ID_ENV_VAR,
    AgentforceRelayGatewayClient,
)

VALID_TENANT = "core/falcondev-core4/00Dxx0000000000"
_OK_RESPONSE = json.dumps({"body": {}, "requestId": "r", "traceId": "t"})


class RelayClientHeaderTests(unittest.TestCase):
    def setUp(self):
        self._env_patch = mock.patch.dict(
            os.environ,
            {
                ORG_JWT_ENV_VAR: "env-jwt",
                APP_CONTEXT_ENV_VAR: "MyApp",
                CORE_TENANT_ID_ENV_VAR: VALID_TENANT,
                USER_ID_ENV_VAR: "005xx0000000000",
            },
        )
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)

    def test_post_sends_identity_headers(self):
        """_post assembles the auth, tenant, app-context, and user-id headers
        from the injected environment."""
        with mock.patch.object(
            _http, "post_json", return_value=(200, _OK_RESPONSE)
        ) as mock_post:
            AgentforceRelayGatewayClient().call_llm_chat_generations({"messages": []})

        _, _, headers = mock_post.call_args.args
        self.assertEqual(headers["Authorization"], "Bearer env-jwt")
        self.assertEqual(headers["x-sfdc-core-tenant-id"], VALID_TENANT)
        self.assertEqual(headers["x-sfdc-app-context"], "MyApp")
        self.assertEqual(headers["x-sfdc-user-id"], "005xx0000000000")

    def test_post_raises_when_app_context_unset(self):
        """_post raises RuntimeError when SFDC_APP_CONTEXT is not set."""
        del os.environ[APP_CONTEXT_ENV_VAR]
        with mock.patch.object(_http, "post_json", return_value=(200, _OK_RESPONSE)):
            with self.assertRaisesRegex(RuntimeError, APP_CONTEXT_ENV_VAR):
                AgentforceRelayGatewayClient().call_llm_generations({"prompt": "hi"})


if __name__ == "__main__":
    unittest.main()
