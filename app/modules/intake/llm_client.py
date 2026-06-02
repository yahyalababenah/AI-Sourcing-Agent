"""
AI-Sourcing Hub — LLM HTTP Client for Translation & Entity Extraction

Handles API calls to Together AI and OpenRouter with fallback support.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import json
import uuid
from typing import Optional

import httpx

from app.config import settings
from app.modules.intake.prompt_templates import (
    TRANSLATE_SYSTEM_PROMPT,
    TRANSLATE_SYSTEM_PROMPT_EN,
    build_translate_user_prompt,
)
from app.shared.exceptions import ProviderUnavailableError
from app.shared.logging import get_logger

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# Providers
# ═══════════════════════════════════════════════════════════

# Default models per provider
TOGETHER_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"
OPENROUTER_MODEL = "deepseek/deepseek-chat"

TOGETHER_BASE_URL = "https://api.together.xyz/v1"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

REQUEST_TIMEOUT = 30.0  # seconds


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════

def _build_messages(system_prompt: str, user_prompt: str) -> list[dict]:
    """Build chat message list for the LLM API."""
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _parse_llm_response(response_text: str) -> dict:
    """Parse JSON from LLM response, handling markdown code fences."""
    text = response_text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        # Find the first newline after ```
        first_nl = text.find("\n")
        if first_nl != -1:
            text = text[first_nl:].strip()
        # Remove trailing ```
        if text.endswith("```"):
            text = text[:-3].strip()
        elif text.endswith("```\n"):
            text = text[:-4].strip()

    # Also handle json \n```\n pattern
    if text.startswith("json"):
        text = text[4:].strip()

    return json.loads(text)


# ═══════════════════════════════════════════════════════════
# API Clients
# ═══════════════════════════════════════════════════════════

async def _call_together(
    messages: list[dict], model: str = TOGETHER_MODEL
) -> dict:
    """Call Together AI chat completions API."""
    if not settings.TOGETHER_API_KEY:
        raise ProviderUnavailableError(
            message="Together AI API key is not configured",
            details={"provider": "together"},
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
                    "max_tokens": 2048,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return _parse_llm_response(content)
        except httpx.TimeoutException:
            raise ProviderUnavailableError(
                message="Together AI request timed out",
                details={"provider": "together", "timeout": REQUEST_TIMEOUT},
            )
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Together AI HTTP error",
                extra={"status_code": exc.response.status_code, "body": exc.response.text},
            )
            raise ProviderUnavailableError(
                message=f"Together AI returned HTTP {exc.response.status_code}",
                details={"provider": "together", "status_code": exc.response.status_code},
            )


async def _call_openrouter(
    messages: list[dict], model: str = OPENROUTER_MODEL
) -> dict:
    """Call OpenRouter chat completions API."""
    if not settings.OPENROUTER_API_KEY:
        raise ProviderUnavailableError(
            message="OpenRouter API key is not configured",
            details={"provider": "openrouter"},
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
                    "max_tokens": 2048,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return _parse_llm_response(content)
        except httpx.TimeoutException:
            raise ProviderUnavailableError(
                message="OpenRouter request timed out",
                details={"provider": "openrouter", "timeout": REQUEST_TIMEOUT},
            )
        except httpx.HTTPStatusError as exc:
            logger.error(
                "OpenRouter HTTP error",
                extra={"status_code": exc.response.status_code, "body": exc.response.text},
            )
            raise ProviderUnavailableError(
                message=f"OpenRouter returned HTTP {exc.response.status_code}",
                details={"provider": "openrouter", "status_code": exc.response.status_code},
            )


# ═══════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════

async def translate_and_extract(
    arabic_text: str,
    provider: Optional[str] = None,
) -> dict:
    """Translate Arabic text to Chinese and extract entities.

    Args:
        arabic_text: Raw Arabic client request.
        provider: Preferred provider ('together' | 'openrouter'). Auto-selects if None.

    Returns:
        Dict with chinese_query, entities, confidence keys.

    Raises:
        ProviderUnavailableError: If no provider is configured or API call fails.
    """
    request_id = str(uuid.uuid4())
    messages = _build_messages(
        TRANSLATE_SYSTEM_PROMPT,
        build_translate_user_prompt(arabic_text),
    )

    # Determine which provider to use
    if provider == "together" and settings.TOGETHER_API_KEY:
        result = await _call_together(messages)
    elif provider == "openrouter" and settings.OPENROUTER_API_KEY:
        result = await _call_openrouter(messages)
    elif settings.TOGETHER_API_KEY:
        result = await _call_together(messages)
    elif settings.OPENROUTER_API_KEY:
        result = await _call_openrouter(messages)
    else:
        raise ProviderUnavailableError(
            message="No LLM provider is configured. Set TOGETHER_API_KEY or OPENROUTER_API_KEY.",
            details={"configured_providers": []},
        )

    result["request_id"] = request_id
    return result
