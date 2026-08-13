"""Base class for runtime providers."""

from abc import ABC, abstractmethod

from agentforce_byoc.gateway.base import BaseRelayGatewayClient


class BaseRuntimeProvider(ABC):
    """
    Abstract base class for runtime environment providers.

    Each runtime provider encapsulates the configuration and gateway clients
    for a specific execution environment (Agentforce runtime or local mock).
    """

    def __init__(self):
        """Initialize runtime provider."""
        self._relay_gateway_client: BaseRelayGatewayClient = None

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the runtime provider name."""
        pass

    @property
    def relay_gateway_client(self) -> BaseRelayGatewayClient:
        """
        Get the Relay gateway client for this runtime.

        Returns:
            Configured Relay gateway client instance

        Raises:
            RuntimeError: If the Relay gateway client is not configured
        """
        if self._relay_gateway_client is None:
            raise RuntimeError(f"Relay gateway client not configured for runtime: {self.name}")
        return self._relay_gateway_client
