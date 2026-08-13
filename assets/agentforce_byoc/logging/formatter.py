"""JSON formatter for structured logging."""

import json
import logging
from datetime import datetime
from typing import Any, Dict


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.

    Outputs log records as JSON objects with fields:
    - timestamp: ISO 8601 timestamp
    - level: Log level name
    - logger: Logger name
    - message: Log message
    - [extra fields]: Any extra fields passed via extra parameter

    Example:
        >>> handler = logging.StreamHandler()
        >>> handler.setFormatter(JSONFormatter())
        >>> logger.addHandler(handler)
        >>> logger.info("Request processed", extra={"request_id": "123", "duration_ms": 45})
        # Output: {"timestamp": "2024-02-10T10:30:00.000Z", "level": "INFO",
        #          "logger": "mymodule", "message": "Request processed",
        #          "request_id": "123", "duration_ms": 45}
    """

    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record as JSON string.

        Args:
            record: Log record to format

        Returns:
            JSON formatted string
        """
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields (passed via extra parameter)
        if hasattr(record, "__dict__"):
            for key, value in record.__dict__.items():
                # Skip standard logging fields
                if key not in [
                    "name",
                    "msg",
                    "args",
                    "created",
                    "filename",
                    "funcName",
                    "levelname",
                    "levelno",
                    "lineno",
                    "module",
                    "msecs",
                    "message",
                    "pathname",
                    "process",
                    "processName",
                    "relativeCreated",
                    "thread",
                    "threadName",
                    "exc_info",
                    "exc_text",
                    "stack_info",
                    "taskName",
                ]:
                    log_data[key] = value

        return json.dumps(log_data)
