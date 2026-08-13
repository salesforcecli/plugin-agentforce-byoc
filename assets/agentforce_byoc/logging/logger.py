"""Logger utilities for Agentforce BYOC SDK."""

import logging
import sys
from typing import Optional


def get_logger(name: str, level: Optional[int] = None) -> logging.Logger:
    """
    Get a configured logger instance.

    Args:
        name: Logger name (typically __name__ of the module)
        level: Optional logging level (defaults to INFO)

    Returns:
        Configured logger instance

    Example:
        >>> from agentforce_byoc.logging import get_logger
        >>> logger = get_logger(__name__)
        >>> logger.info("Processing request", extra={"request_id": "123"})
    """
    logger = logging.getLogger(name)

    # Set level
    if level is None:
        level = logging.INFO
    logger.setLevel(level)

    # Avoid duplicate handlers
    if not logger.handlers:
        # Console handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)

        # Format: timestamp - name - level - message
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
