"""
AI-Sourcing Hub — LLM HTTP Client for Translation & Entity Extraction

Handles API calls to Together AI and OpenRouter with fallback support.
Implements retry logic with exponential backoff (3 attempts: 1s/4s/15s).
Two-stage pipeline: extract entities (Prompt A) → translate to Chinese (Prompt B).
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import json
import uuid
from typing import Optional

import httpx

from app.config import settings
from app.modules.intake.prompt_templates import (
    EXTRACT_SYSTEM_PROMPT,
    TRANSLATE_SYSTEM_PROMPT,
    TRANSLATE_SYSTEM_PROMPT_EN,
    build_extract_user_prompt,
    build_translate_user_prompt,
)
from app.shared.exceptions import IncompleteExtractionError, ProviderUnavailableError
from app.shared.logging import get_logger

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════
# Providers
# ═══════════════════════════════════════════════════════════

# Default models per provider
# OpenRouter has a valid API key; Together AI key is test-only
# Models verified available as of 2026-06:
#   - meta-llama/llama-3.3-70b-instruct:free  (free, excellent Arabic)
#   - qwen/qwen3-next-80b-a3b-instruct:free    (free, good alternative)
TOGETHER_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"
OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

TOGETHER_BASE_URL = "https://api.together.xyz/v1"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

REQUEST_TIMEOUT = 30.0  # seconds

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAYS = [1.0, 4.0, 15.0]  # seconds between retries


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


def _validate_extraction(result: dict) -> None:
    """Validate that entity extraction returned usable data.

    Checks:
        - products list exists and is non-empty
        - each product has a non-empty name_arabic
        - each product has quantity > 0

    Raises:
        IncompleteExtractionError: If validation fails.
    """
    products = result.get("products", [])
    if not products:
        raise IncompleteExtractionError(
            message="LLM returned no products — could not extract any entities",
            details={"partial_result": result},
        )

    for i, product in enumerate(products):
        name = product.get("name_arabic", "").strip()
        if not name:
            raise IncompleteExtractionError(
                message=f"Product at index {i} has no name",
                details={"product_index": i, "product": product},
            )
        quantity = product.get("quantity", 0)
        if not isinstance(quantity, (int, float)) or quantity <= 0:
            raise IncompleteExtractionError(
                message=f"Product '{name}' has invalid quantity: {quantity}",
                details={"product_index": i, "product": product, "quantity": quantity},
            )


# ═══════════════════════════════════════════════════════════
# Retry Logic
# ═══════════════════════════════════════════════════════════


def _get_retry_delay(attempt: int) -> float:
    """Get delay in seconds for the given retry attempt (0-indexed).

    Args:
        attempt: Retry attempt number (0 = first retry, 1 = second, etc.)

    Returns:
        Delay in seconds.
    """
    if attempt < len(RETRY_DELAYS):
        return RETRY_DELAYS[attempt]
    return RETRY_DELAYS[-1]  # cap at max delay


async def _call_with_retry(
    provider_name: str,
    messages: list[dict],
    model: str,
) -> dict:
    """Call an LLM provider with retry logic and exponential backoff.

    Tries OpenRouter first, then falls back to Together AI if configured.
    Within each provider, retries up to MAX_RETRIES times with increasing delays.

    Args:
        provider_name: 'together' or 'openrouter'.
        messages: Chat messages list.
        model: Model name string.

    Returns:
        Parsed JSON response dict.

    Raises:
        ProviderUnavailableError: If all retries and fallbacks are exhausted.
    """
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            if provider_name == "together":
                return await _call_together(messages, model=model)
            else:
                return await _call_openrouter(messages, model=model)
        except ProviderUnavailableError as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                delay = _get_retry_delay(attempt)
                logger.warning(
                    f"{provider_name} attempt {attempt + 1}/{MAX_RETRIES} failed — "
                    f"retrying in {delay:.0f}s",
                    extra={
                        "provider": provider_name,
                        "attempt": attempt + 1,
                        "max_retries": MAX_RETRIES,
                        "delay_seconds": delay,
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
                        "last_error": str(exc),
                    },
                )

    # All retries exhausted — re-raise the last error
    raise ProviderUnavailableError(
        message=f"{provider_name} failed after {MAX_RETRIES} retries",
        details={
            "provider": provider_name,
            "attempts": MAX_RETRIES,
            "last_error": str(last_error),
        },
    )


async def _call_with_fallback(
    messages: list[dict],
    preferred_provider: Optional[str] = None,
) -> dict:
    """Call an LLM with provider fallback and per-provider retry logic.

    Provider preference order:
        1. preferred_provider (if specified and configured)
        2. OpenRouter (if configured — primary, uses free-tier models)
        3. Together AI (if configured, as fallback)

    Each provider gets its own retry loop before fallback kicks in.

    Args:
        messages: Chat messages list.
        preferred_provider: Optional provider override.

    Returns:
        Parsed JSON response dict.

    Raises:
        ProviderUnavailableError: If no provider is configured or all fail.
    """
    # Resolve provider order
    providers: list[tuple[str, str]] = []

    if preferred_provider == "together" and settings.TOGETHER_API_KEY:
        providers.append(("together", TOGETHER_MODEL))
        if settings.OPENROUTER_API_KEY:
            providers.append(("openrouter", OPENROUTER_MODEL))
    elif preferred_provider == "openrouter" and settings.OPENROUTER_API_KEY:
        providers.append(("openrouter", OPENROUTER_MODEL))
        if settings.TOGETHER_API_KEY:
            providers.append(("together", TOGETHER_MODEL))
    else:
        # Default: OpenRouter first (free-tier), Together AI as fallback
        if settings.OPENROUTER_API_KEY:
            providers.append(("openrouter", OPENROUTER_MODEL))
        if settings.TOGETHER_API_KEY:
            providers.append(("together", TOGETHER_MODEL))

    if not providers:
        raise ProviderUnavailableError(
            message="No LLM provider is configured. Set TOGETHER_API_KEY or OPENROUTER_API_KEY.",
            details={"configured_providers": []},
        )

    errors: list[str] = []
    for provider_name, model in providers:
        try:
            return await _call_with_retry(provider_name, messages, model)
        except ProviderUnavailableError as exc:
            errors.append(str(exc))
            logger.info(
                f"Falling back from {provider_name} to next provider",
                extra={"failed_provider": provider_name},
            )

    # All providers exhausted
    raise ProviderUnavailableError(
        message="All LLM providers failed after retries",
        details={"provider_errors": errors},
    )


# ═══════════════════════════════════════════════════════════
# API Clients (low-level, no retry — retry handled by _call_with_retry)
# ═══════════════════════════════════════════════════════════


async def _call_together(
    messages: list[dict], model: str = TOGETHER_MODEL
) -> dict:
    """Call Together AI chat completions API.

    Raises:
        ProviderUnavailableError: On API key missing, timeout, or HTTP error.
    """
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
    """Call OpenRouter chat completions API.

    Raises:
        ProviderUnavailableError: On API key missing, timeout, or HTTP error.
    """
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
# Two-Stage Pipeline
# ═══════════════════════════════════════════════════════════


async def extract_entities(
    arabic_text: str,
    provider: Optional[str] = None,
) -> dict:
    """Stage 1: Extract product entities from Arabic text (Prompt A).

    Args:
        arabic_text: Raw Arabic client request text.
        provider: Preferred provider ('together' | 'openrouter'). Auto-selects if None.

    Returns:
        Dict with products list, destination_port, target_currency, urgency.

    Raises:
        ProviderUnavailableError: If all LLM providers fail.
        IncompleteExtractionError: If extraction returns no products or invalid data.
    """
    request_id = str(uuid.uuid4())
    messages = _build_messages(
        EXTRACT_SYSTEM_PROMPT,
        build_extract_user_prompt(arabic_text),
    )

    result = await _call_with_fallback(messages, preferred_provider=provider)
    _validate_extraction(result)

    result["request_id"] = request_id
    return result


async def translate_to_chinese(
    arabic_text: str,
    extracted_entities: dict,
    provider: Optional[str] = None,
) -> dict:
    """Stage 2: Translate extracted entities to Chinese (Prompt B).

    Args:
        arabic_text: Original Arabic client request text.
        extracted_entities: Entities dict from extract_entities().
        provider: Preferred provider ('together' | 'openrouter'). Auto-selects if None.

    Returns:
        Dict with translated_products list and translated_query string.

    Raises:
        ProviderUnavailableError: If all LLM providers fail.
    """
    request_id = str(uuid.uuid4())
    messages = _build_messages(
        TRANSLATE_SYSTEM_PROMPT,
        build_translate_user_prompt(arabic_text, extracted_entities),
    )

    result = await _call_with_fallback(messages, preferred_provider=provider)
    result["request_id"] = request_id
    return result


async def translate_and_extract(
    arabic_text: str,
    provider: Optional[str] = None,
) -> dict:
    """End-to-end: Extract entities then translate to Chinese.

    Convenience function that chains extract_entities() → translate_to_chinese()
    and merges results into a single response dict.

    Args:
        arabic_text: Raw Arabic client request.
        provider: Preferred provider ('together' | 'openrouter'). Auto-selects if None.

    Returns:
        Dict with request_id, chinese_query, entities, confidence.

    Raises:
        ProviderUnavailableError: If all LLM providers fail.
        IncompleteExtractionError: If extraction returns no products.
    """
    # Stage 1: Extract entities
    extraction = await extract_entities(arabic_text, provider=provider)

    # Stage 2: Translate to Chinese
    translation = await translate_to_chinese(
        arabic_text,
        extracted_entities=extraction,
        provider=provider,
    )

    # Merge results into expected response format
    return {
        "request_id": extraction.get("request_id"),
        "chinese_query": translation.get("translated_query", ""),
        "entities": extraction,
        "confidence": 0.9,  # default confidence; can be refined later
    }
