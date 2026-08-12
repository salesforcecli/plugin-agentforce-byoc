"""Mock runtime provider for local testing."""

from agentforce_byoc.gateway.mock_relay_client import MockRelayGatewayClient
from agentforce_byoc.runtime.base import BaseRuntimeProvider


class MockRuntimeProvider(BaseRuntimeProvider):
    """
    Mock runtime provider for local development outside AWS AgentCore.

    Wires up the :class:`MockRelayGatewayClient`, which behaves like the
    Agentforce client but takes the org JWT from the SDK author (constructor
    arg or the ``ORG_JWT_TOKEN`` env var).

    Example:
        This provider is selected when the AGENTFORCE_BYOC_MOCK env var is set:

        >>> import os
        >>> os.environ["AGENTFORCE_BYOC_MOCK"] = "1"
        >>> from agentforce_byoc import get_client
        >>> client = get_client()
        >>> client.call_llm_generations(
        ...     tenant_id="core/falcondev-core4/00Dxx0000000000",
        ...     parameter={"prompt": "What is AI?"},
        ... )
    """

    def __init__(self):
        """Initialize mock runtime provider."""
        super().__init__()
        self._relay_gateway_client = MockRelayGatewayClient()

    @property
    def name(self) -> str:
        """Return runtime name."""
        return "mock"
