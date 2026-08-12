"""Agentforce BYOC runtime provider."""

from agentforce_byoc.gateway.relay_client import AgentforceRelayGatewayClient
from agentforce_byoc.logging import get_logger
from agentforce_byoc.runtime.base import BaseRuntimeProvider

logger = get_logger(__name__)


class AgentforceRuntimeProvider(BaseRuntimeProvider):
    """
    Agentforce BYOC runtime provider.

    This is the default runtime, used when running inside AWS AgentCore. It
    wires up the :class:`AgentforceRelayGatewayClient`, which relays calls
    through the Agentforce Relay API.

    The org JWT is read from the ``ORG_JWT_TOKEN`` environment variable
    injected into the sandbox, and the SFAP endpoint is derived per call from
    the tenant id passed to each relay method.
    """

    def __init__(self):
        """Initialize the Agentforce runtime provider."""
        super().__init__()
        logger.info("Initialized Agentforce BYOC runtime")
        self._relay_gateway_client = AgentforceRelayGatewayClient()

    @property
    def name(self) -> str:
        """Return runtime name."""
        return "agentforce"
