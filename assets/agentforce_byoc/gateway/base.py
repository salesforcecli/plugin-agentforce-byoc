"""Base class for relay gateway clients."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseRelayGatewayClient(ABC):
    """
    Abstract base class for Relay gateway clients.

    The Relay gateway proxies API calls from BYOC code (running in the
    AgentCore sandbox, which has no direct outbound network) through the
    Agentforce Relay API. Each relay function is exposed as a method.

    Implementations must relay the raw ``parameter`` body through to the
    Relay API unchanged.
    """

    @abstractmethod
    def call_llm_generations(self, tenant_id: str, parameter: Dict[str, Any]) -> Dict[str, Any]:
        """
        Relay an LLM generations call (Relay function ``llm``).

        Args:
            tenant_id: Core tenant id (``core/<instance>-<fd>/<org-id>``).
            parameter: Raw request body, passed through to the Relay API as-is.

        Returns:
            The Relay API response envelope (``{body, requestId, traceId}``).
        """
        ...

    @abstractmethod
    def call_llm_chat_generations(
        self, tenant_id: str, parameter: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Relay an LLM chat generations call (Relay function ``llm_chat``).

        Args:
            tenant_id: Core tenant id (``core/<instance>-<fd>/<org-id>``).
            parameter: Raw request body, passed through to the Relay API as-is.

        Returns:
            The Relay API response envelope (``{body, requestId, traceId}``).
        """
        ...
