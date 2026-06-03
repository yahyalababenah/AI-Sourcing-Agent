"""
AI-Sourcing Hub — Vision LLM Client

Handles image-based document analysis via Qwen2.5-VL-72B
(OpenRouter / Together AI multimodal endpoints).

Implements:
    - Retry logic with exponential backoff + jitter (base 2s, max 60s) on 429
    - Provider fallback: OpenRouter → Together AI on 503
    - Base64 image encoding and multimodal message building
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import base64
import json
import random
from typing import Optional

import httpx

from app.config import settings
from app.modules.documents.prompt_templates import (
    VISION_EXTRACT_SYSTEM_PROMPT,
    VISION_EXTRACT_USER_PROMPT,
)
from app.shared.exceptions import ProviderUnavailableError
from app.shared.logging import get_logger

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════

# OpenRouter models: check https://openrouter.ai/models for current availability
# OpenRouter has a valid API key; Together AI key is test-only
# Models verified available as of 2026-06:
#   - qwen/qwen2.5-vl-72b-instruct  ($0.00000025/tok — excellent table extraction)
#   - qwen/qwen3-vl-32b-instruct     ($0.000000104/tok — cheaper, good quality)
#   - nvidia/nemotron-nano-12b-v2-vl:free  (free)
OPENROUTER_VL_MODEL = "qwen/qwen2.5-vl-72b-instruct"
TOGETHER_VL_MODEL = "Qwen/Qwen2.5-VL-72B-Instruct-Turbo"

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
TOGETHER_BASE_URL = "https://api.together.xyz/v1"

REQUEST_TIMEOUT = 60.0  # Vision models are slower

# Retry configuration
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2.0  # seconds (with jitter)
RETRY_MAX_DELAY = 60.0  # seconds (cap)
RETRY_JITTER_FACTOR = 0.5  # ±50% jitter

# HTTP status codes that trigger retry
RETRYABLE_STATUS_CODES = {429, 502, 503, 504}


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════


def _encode_image(image_bytes: bytes) -> str:
    """Base64-encode image bytes."""
    return base64.b64encode(image_bytes).decode("utf-8")


def _build_vision_messages(
    image_base64: str,
    media_type: str = "image/png",
) -> list[dict]:
    """Build multimodal message array for vision API."""
    return [
        {"role": "system", "content": VISION_EXTRACT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_type};base64,{image_base64}",
                    },
                },
                {"type": "text", "text": VISION_EXTRACT_USER_PROMPT},
            ],
        },
    ]


def _get_retry_delay_with_jitter(attempt: int) -> float:
    """Get delay in seconds with jitter for the given retry attempt.

    Uses exponential backoff: base_delay * 2^attempt + jitter.

    Args:
        attempt: Retry attempt number (0-indexed).

    Returns:
        Delay in seconds with jitter applied.
    """
    delay = RETRY_BASE_DELAY * (2 ** attempt)
    delay = min(delay, RETRY_MAX_DELAY)
    # Apply jitter: ±50%, then cap at max delay
    jitter = delay * RETRY_JITTER_FACTOR
    return min(delay + random.uniform(-jitter, jitter), RETRY_MAX_DELAY)


def _is_retryable_status(status_code: int) -> bool:
    """Check if HTTP status code should trigger a retry.

    Args:
        status_code: HTTP response status code.

    Returns:
        True if the request should be retried.
    """
    return status_code in RETRYABLE_STATUS_CODES


def _is_provider_overloaded(status_code: int) -> bool:
    """Check if status code indicates provider overload (503).

    Args:
        status_code: HTTP response status code.

    Returns:
        True if provider is overloaded and fallback should be attempted.
    """
    return status_code == 503


# ═══════════════════════════════════════════════════════════
# API Clients (low-level, no retry — retry handled by _call_with_fallback)
# ═══════════════════════════════════════════════════════════


async def _call_openrouter_vision(
    messages: list[dict],
    model: str = OPENROUTER_VL_MODEL,
) -> dict:
    """Call OpenRouter multimodal endpoint.

    Raises:
        ProviderUnavailableError: On API key missing, timeout, or HTTP error.
    """
    if not settings.OPENROUTER_API_KEY:
        raise ProviderUnavailableError(
            message="OpenRouter API key is not configured (required for vision)",
            details={"provider": "openrouter_vision"},
        )

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://aisourcing.local",
                    "X-Title": "AI-Sourcing Hub",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 4096,
                },
            )

            # Check for retryable / overloaded status codes
            if response.status_code == 429:
                raise ProviderUnavailableError(
                    message="OpenRouter vision rate limited (429)",
                    details={"provider": "openrouter_vision", "status_code": 429},
                )
            if response.status_code == 503:
                raise ProviderUnavailableError(
                    message="OpenRouter vision overloaded (503)",
                    details={"provider": "openrouter_vision", "status_code": 503},
                )

            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return {"raw_response": content}

        except httpx.TimeoutException:
            raise ProviderUnavailableError(
                message="OpenRouter vision request timed out",
                details={
                    "provider": "openrouter_vision",
                    "timeout": REQUEST_TIMEOUT,
                },
            )
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if _is_retryable_status(status):
                raise ProviderUnavailableError(
                    message=f"OpenRouter vision retryable error ({status})",
                    details={
                        "provider": "openrouter_vision",
                        "status_code": status,
                    },
                )
            logger.error(
                "OpenRouter vision HTTP error",
                extra={
                    "status_code": status,
                    "body": exc.response.text[:500],
                },
            )
            raise ProviderUnavailableError(
                message=f"OpenRouter vision returned HTTP {status}",
                details={"provider": "openrouter_vision", "status_code": status},
            )


async def _call_together_vision(
    messages: list[dict],
    model: str = TOGETHER_VL_MODEL,
) -> dict:
    """Call Together AI multimodal endpoint.

    Raises:
        ProviderUnavailableError: On API key missing, timeout, or HTTP error.
    """
    if not settings.TOGETHER_API_KEY:
        raise ProviderUnavailableError(
            message="Together AI API key is not configured (required for vision)",
            details={"provider": "together_vision"},
        )

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{TOGETHER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.TOGETHER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 4096,
                },
            )

            # Check for retryable / overloaded status codes
            if response.status_code == 429:
                raise ProviderUnavailableError(
                    message="Together AI vision rate limited (429)",
                    details={"provider": "together_vision", "status_code": 429},
                )
            if response.status_code == 503:
                raise ProviderUnavailableError(
                    message="Together AI vision overloaded (503)",
                    details={"provider": "together_vision", "status_code": 503},
                )

            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return {"raw_response": content}

        except httpx.TimeoutException:
            raise ProviderUnavailableError(
                message="Together AI vision request timed out",
                details={
                    "provider": "together_vision",
                    "timeout": REQUEST_TIMEOUT,
                },
            )
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if _is_retryable_status(status):
                raise ProviderUnavailableError(
                    message=f"Together AI vision retryable error ({status})",
                    details={
                        "provider": "together_vision",
                        "status_code": status,
                    },
                )
            logger.error(
                "Together AI vision HTTP error",
                extra={
                    "status_code": status,
                    "body": exc.response.text[:500],
                },
            )
            raise ProviderUnavailableError(
                message=f"Together AI vision returned HTTP {status}",
                details={"provider": "together_vision", "status_code": status},
            )


# ═══════════════════════════════════════════════════════════
# Retry & Fallback Logic
# ═══════════════════════════════════════════════════════════


async def _call_vision_with_retry(
    provider_name: str,
    messages: list[dict],
    model: str,
) -> dict:
    """Call a single vision provider with retry logic and exponential backoff.

    Retries on:
        - 429 (rate limited): backoff with jitter
        - 503 (overloaded): will be caught and trigger provider fallback
        - Timeout: backoff with jitter
        - Other 5xx: backoff with jitter

    Args:
        provider_name: 'openrouter' or 'together'.
        messages: Multimodal message list.
        model: Model name string.

    Returns:
        Dict with 'raw_response' key containing the VLM's text output.

    Raises:
        ProviderUnavailableError: If all retries are exhausted.
    """
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            if provider_name == "openrouter":
                return await _call_openrouter_vision(messages, model=model)
            else:
                return await _call_together_vision(messages, model=model)
        except ProviderUnavailableError as exc:
            last_error = exc
            details = exc.details or {}
            status_code = details.get("status_code", 0)

            # 503: provider overloaded — don't retry, fall back to other provider
            if _is_provider_overloaded(status_code):
                logger.warning(
                    f"{provider_name} overloaded (503) — triggering provider fallback",
                    extra={
                        "provider": provider_name,
                        "attempt": attempt + 1,
                    },
                )
                raise  # Will be caught by _call_vision_with_fallback

            if attempt < MAX_RETRIES - 1:
                delay = _get_retry_delay_with_jitter(attempt)
                logger.warning(
                    f"{provider_name} attempt {attempt + 1}/{MAX_RETRIES} failed "
                    f"with status {status_code} — retrying in {delay:.1f}s",
                    extra={
                        "provider": provider_name,
                        "attempt": attempt + 1,
                        "max_retries": MAX_RETRIES,
                        "delay_seconds": round(delay, 1),
                        "status_code": status_code,
                        "error": str(exc),
                    },
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    f"{provider_name} exhausted after {MAX_RETRIES} attempts",
                    extra={
                        "provider": provider_name,
                        "attempts": MAX_RETRIES,
                        "last_status_code": status_code,
                        "last_error": str(exc),
                    },
                )

    # All retries exhausted — re-raise the last error
    raise ProviderUnavailableError(
        message=f"{provider_name} vision failed after {MAX_RETRIES} retries",
        details={
            "provider": provider_name,
            "attempts": MAX_RETRIES,
            "last_error": str(last_error),
        },
    )


async def _call_vision_with_fallback(
    messages: list[dict],
    preferred_provider: Optional[str] = None,
) -> dict:
    """Call vision API with provider fallback and per-provider retry logic.

    Provider preference order:
        1. preferred_provider (if specified and configured)
        2. OpenRouter (if configured — primary vision provider)
        3. Together AI (if configured — fallback)

    If the primary provider returns 503 (overloaded), immediately fall back
    to the secondary provider instead of retrying.

    Args:
        messages: Multimodal message list.
        preferred_provider: Optional provider override.

    Returns:
        Dict with 'raw_response' key.

    Raises:
        ProviderUnavailableError: If no vision provider is configured or all fail.
    """
    # Resolve provider order
    providers: list[tuple[str, str]] = []

    if preferred_provider == "openrouter" and settings.OPENROUTER_API_KEY:
        providers.append(("openrouter", OPENROUTER_VL_MODEL))
        if settings.TOGETHER_API_KEY:
            providers.append(("together", TOGETHER_VL_MODEL))
    elif preferred_provider == "together" and settings.TOGETHER_API_KEY:
        providers.append(("together", TOGETHER_VL_MODEL))
        if settings.OPENROUTER_API_KEY:
            providers.append(("openrouter", OPENROUTER_VL_MODEL))
    else:
        # Default: OpenRouter first (better vision support), Together as fallback
        if settings.OPENROUTER_API_KEY:
            providers.append(("openrouter", OPENROUTER_VL_MODEL))
        if settings.TOGETHER_API_KEY:
            providers.append(("together", TOGETHER_VL_MODEL))

    if not providers:
        raise ProviderUnavailableError(
            message="No vision-capable LLM provider configured. "
            "Set OPENROUTER_API_KEY or TOGETHER_API_KEY.",
            details={"configured_providers": []},
        )

    errors: list[str] = []
    for provider_name, model in providers:
        try:
            return await _call_vision_with_retry(provider_name, messages, model)
        except ProviderUnavailableError as exc:
            errors.append(str(exc))
            logger.info(
                f"Falling back from {provider_name} to next vision provider",
                extra={"failed_provider": provider_name},
            )

    # All providers exhausted
    raise ProviderUnavailableError(
        message="All vision providers failed after retries",
        details={"provider_errors": errors},
    )


# ═══════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════


async def extract_table_from_image(
    image_bytes: bytes,
    media_type: str = "image/png",
    provider: Optional[str] = None,
) -> str:
    """Extract structured product table data from a document image.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.).
        media_type: MIME type of the image.
        provider: Preferred provider ('together' | 'openrouter').

    Returns:
        Raw text response from the VLM (JSON string to be repaired/parsed).

    Raises:
        ProviderUnavailableError: If no vision-capable provider is configured
                                  or all providers/retries fail.
    """
    image_b64 = _encode_image(image_bytes)
    messages = _build_vision_messages(image_b64, media_type=media_type)

    result = await _call_vision_with_fallback(messages, preferred_provider=provider)
    return result["raw_response"]


# ═══════════════════════════════════════════════════════════
# Legacy alias for backward compatibility
# ═══════════════════════════════════════════════════════════

extract_from_image = extract_table_from_image
