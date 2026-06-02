"""
AI-Sourcing Hub — Vision LLM Client

Handles image-based document analysis via Qwen2.5-VL-72B
(OpenRouter / Together AI multimodal endpoints).
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import base64
import json
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

OPENROUTER_VL_MODEL = "qwen/qwen2.5-vl-72b-instruct"
TOGETHER_VL_MODEL = "Qwen/Qwen2.5-VL-72B-Instruct-Turbo"

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
TOGETHER_BASE_URL = "https://api.together.xyz/v1"

REQUEST_TIMEOUT = 60.0  # Vision models are slower


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


def _parse_vision_response(response_text: str) -> dict:
    """Parse JSON from VLM response, handling markdown fences."""
    text = response_text.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        first_nl = text.find("\n")
        if first_nl != -1:
            text = text[first_nl:].strip()
        if text.endswith("```"):
            text = text[:-3].strip()
        elif text.endswith("```\n"):
            text = text[:-4].strip()

    if text.startswith("json"):
        text = text[4:].strip()

    return json.loads(text)


# ═══════════════════════════════════════════════════════════
# API Clients
# ═══════════════════════════════════════════════════════════

async def _call_openrouter_vision(
    messages: list[dict],
    model: str = OPENROUTER_VL_MODEL,
) -> dict:
    """Call OpenRouter multimodal endpoint."""
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
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return _parse_vision_response(content)
        except httpx.TimeoutException:
            raise ProviderUnavailableError(
                message="OpenRouter vision request timed out",
                details={"provider": "openrouter_vision", "timeout": REQUEST_TIMEOUT},
            )
        except httpx.HTTPStatusError as exc:
            logger.error(
                "OpenRouter vision HTTP error",
                extra={"status_code": exc.response.status_code, "body": exc.response.text},
            )
            raise ProviderUnavailableError(
                message=f"OpenRouter vision returned HTTP {exc.response.status_code}",
                details={"provider": "openrouter_vision"},
            )


async def _call_together_vision(
    messages: list[dict],
    model: str = TOGETHER_VL_MODEL,
) -> dict:
    """Call Together AI multimodal endpoint."""
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
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return _parse_vision_response(content)
        except httpx.TimeoutException:
            raise ProviderUnavailableError(
                message="Together AI vision request timed out",
                details={"provider": "together_vision", "timeout": REQUEST_TIMEOUT},
            )
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Together AI vision HTTP error",
                extra={"status_code": exc.response.status_code, "body": exc.response.text},
            )
            raise ProviderUnavailableError(
                message=f"Together AI vision returned HTTP {exc.response.status_code}",
                details={"provider": "together_vision"},
            )


# ═══════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════

async def extract_from_image(
    image_bytes: bytes,
    media_type: str = "image/png",
    provider: Optional[str] = None,
) -> dict:
    """Extract structured product data from a document image.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, etc.).
        media_type: MIME type of the image.
        provider: Preferred provider ('together' | 'openrouter').

    Returns:
        Dict with document_type, products, supplier_info, trade_terms, confidence.

    Raises:
        ProviderUnavailableError: If no vision-capable provider is configured.
    """
    image_b64 = _encode_image(image_bytes)
    messages = _build_vision_messages(image_b64, media_type=media_type)

    if provider == "openrouter" and settings.OPENROUTER_API_KEY:
        return await _call_openrouter_vision(messages)
    elif provider == "together" and settings.TOGETHER_API_KEY:
        return await _call_together_vision(messages)
    elif settings.OPENROUTER_API_KEY:
        return await _call_openrouter_vision(messages)
    elif settings.TOGETHER_API_KEY:
        return await _call_together_vision(messages)
    else:
        raise ProviderUnavailableError(
            message="No vision-capable LLM provider configured. "
                    "Set OPENROUTER_API_KEY or TOGETHER_API_KEY.",
            details={"configured_providers": []},
        )
