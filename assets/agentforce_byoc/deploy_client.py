"""HTTP client for the Agentforce BYOC deploy/upload API.

Implements the two-step package upload against ai-byoc-proxy (fronted by SFAP):

1. ``POST <base>/byoc/upload`` to obtain a presigned S3 URL.
2. ``PUT`` the package archive to that presigned URL.
3. ``POST <base>/byoc/upload/status`` to register package metadata.

The base URL is resolved from the tenant id by
:func:`agentforce_byoc.gateway.relay_client.resolve_sfap_base_url`. Auth is sent
as ``Authorization: Bearer <org-jwt>`` plus the ``x-sfdc-core-tenant-id`` header;
the proxy reads the tenant from that header and SFAP verifies the JWT.

Uses only the Python standard library so nothing extra is bundled into a BYOC
package.
"""

import json
from pathlib import Path
from typing import Any, Dict, List

from agentforce_byoc import _http
from agentforce_byoc.logging import get_logger

logger = get_logger(__name__)

# The presigned URL is signed by the proxy with ContentType "application/gzip"
# (see ai-byoc-proxy package_service.generate_presigned_upload_url). The PUT
# must send exactly this Content-Type or S3 rejects the signature.
_PACKAGE_CONTENT_TYPE = "application/gzip"

# Timeout (seconds) for control-plane calls and the S3 upload PUT.
_DEPLOY_TIMEOUT_S = 120


def _post_json(url: str, body: Dict[str, Any], org_jwt: str, tenant_id: str) -> Dict[str, Any]:
    """
    POST a JSON body to a BYOC control-plane endpoint and parse the response.

    Sends the org JWT as a bearer token and the tenant id as the
    ``x-sfdc-core-tenant-id`` header.

    Raises:
        RuntimeError: On HTTP error, transport error, or a non-JSON response.
    """
    # SFAP verifies the OrgJWT and derives the tenant; we also pass the tenant
    # header explicitly. A 400 "x-sfdc-core-tenant-id header is required" comes
    # from SFAP rejecting the JWT, not a missing header here.
    headers = {
        "Authorization": f"Bearer {org_jwt}",
        "x-sfdc-core-tenant-id": tenant_id,
    }
    try:
        status, raw = _http.post_json(url, body, headers, timeout=_DEPLOY_TIMEOUT_S)
    except OSError as e:
        raise RuntimeError(f"BYOC API call to {url} failed: {e}") from e

    # Surface the BYOC service response (status + body) so callers can see
    # exactly what the control plane returned.
    logger.info("BYOC API %s -> status=%s body=%s", url, status, raw)

    if status >= 400:
        raise RuntimeError(f"BYOC API call to {url} failed with status {status}: {raw}")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"BYOC API at {url} returned a non-JSON response: {raw!r}") from e


def _put_file(url: str, file_path: Path, content_type: str) -> None:
    """
    PUT a file's bytes to a (presigned) URL.

    No auth header is added: the presigned URL carries its own signature.

    Raises:
        RuntimeError: On HTTP error or transport error.
    """
    data = file_path.read_bytes()
    try:
        status, raw = _http.request(
            "PUT",
            url,
            headers={"Content-Type": content_type},
            body=data,
            timeout=_DEPLOY_TIMEOUT_S,
        )
    except OSError as e:
        raise RuntimeError(f"Upload to presigned URL failed: {e}") from e

    if status >= 400:
        body_text = raw.decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Upload to presigned URL failed with status {status}: {body_text}"
        )


def request_presigned_upload(
    base_url: str,
    tenant_id: str,
    org_jwt: str,
    package_name: str,
    version: str,
) -> Dict[str, Any]:
    """
    Step 1: request a presigned S3 upload URL.

    Returns:
        The proxy response ``{uploadUrl, s3Key, tenantId, packageName, version}``.
    """
    url = f"{base_url}/byoc/upload"
    body = {"packageName": package_name, "version": version}
    logger.info("Requesting presigned upload URL from %s", url)
    return _post_json(url, body, org_jwt, tenant_id)


def upload_package(upload_url: str, file_path: Path) -> None:
    """Step 2: upload the package archive to the presigned URL."""
    logger.info("Uploading %s (%d bytes)", file_path.name, file_path.stat().st_size)
    _put_file(upload_url, file_path, _PACKAGE_CONTENT_TYPE)


def report_upload_status(
    base_url: str,
    tenant_id: str,
    org_jwt: str,
    package_name: str,
    version: str,
    package_size: int,
    entry_points: List[str],
    max_live_duration_s: int,
) -> Dict[str, Any]:
    """
    Step 3: report upload status and register package metadata.

    Returns:
        The stored metadata record.
    """
    url = f"{base_url}/byoc/upload/status"
    body = {
        "packageName": package_name,
        "version": version,
        "packageSize": package_size,
        "entryPoints": entry_points,
        "maxLiveDurationS": max_live_duration_s,
    }
    logger.info("Reporting upload status to %s", url)
    return _post_json(url, body, org_jwt, tenant_id)
