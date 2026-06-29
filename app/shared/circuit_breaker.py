"""
AI-Sourcing Hub — Redis-Backed Circuit Breaker

Prevents cascading failures when external providers (LLM, exchange rate API)
are consistently unavailable.

States:
    CLOSED   — Normal operation. Failures increment the counter.
    OPEN     — Fast-fail: no requests sent. Resets after recovery_timeout.
    HALF_OPEN — One test request allowed. Success → CLOSED, failure → OPEN.

Usage:
    breaker = CircuitBreaker("llm_openrouter", failure_threshold=5, recovery_timeout=120)

    if not await breaker.call_allowed(redis):
        raise ProviderUnavailableError("Circuit is open")

    try:
        result = await call_provider()
        await breaker.record_success(redis)
        return result
    except Exception:
        await breaker.record_failure(redis)
        raise
"""

import time
from typing import Optional

from app.shared.logging import get_logger

logger = get_logger(__name__)


class CircuitBreakerOpen(Exception):
    """Raised when a circuit breaker is OPEN."""


class CircuitBreaker:
    """Redis-backed circuit breaker for external API calls."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 120,
        success_threshold: int = 2,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

    # ── Redis key helpers ────────────────────────────────────────────

    @property
    def _state_key(self) -> str:
        return f"circuit:{self.name}:state"

    @property
    def _failures_key(self) -> str:
        return f"circuit:{self.name}:failures"

    @property
    def _successes_key(self) -> str:
        return f"circuit:{self.name}:successes"

    @property
    def _opened_at_key(self) -> str:
        return f"circuit:{self.name}:opened_at"

    # ── State machine ────────────────────────────────────────────────

    async def get_state(self, redis) -> str:
        raw = await redis.get(self._state_key)
        if raw is None:
            return self.CLOSED

        state = raw.decode() if isinstance(raw, bytes) else raw

        if state == self.OPEN:
            opened_raw = await redis.get(self._opened_at_key)
            if opened_raw:
                opened_at = float(
                    opened_raw.decode() if isinstance(opened_raw, bytes) else opened_raw
                )
                if time.time() - opened_at >= self.recovery_timeout:
                    await redis.set(self._state_key, self.HALF_OPEN)
                    logger.info(
                        "Circuit breaker transitioned OPEN → HALF_OPEN",
                        extra={"circuit": self.name},
                    )
                    return self.HALF_OPEN

        return state

    async def call_allowed(self, redis) -> bool:
        """Return True if a call should be attempted."""
        state = await self.get_state(redis)
        if state == self.OPEN:
            logger.warning(
                "Circuit breaker OPEN — call blocked",
                extra={"circuit": self.name},
            )
            return False
        return True

    async def record_success(self, redis) -> None:
        """Record a successful call. May close the circuit."""
        state = await self.get_state(redis)

        if state == self.HALF_OPEN:
            successes = int(await redis.incr(self._successes_key))
            await redis.expire(self._successes_key, self.recovery_timeout * 2)
            if successes >= self.success_threshold:
                await redis.delete(
                    self._state_key,
                    self._failures_key,
                    self._successes_key,
                    self._opened_at_key,
                )
                logger.info(
                    "Circuit breaker CLOSED after recovery",
                    extra={"circuit": self.name},
                )
        elif state == self.CLOSED:
            await redis.delete(self._failures_key)

    async def record_failure(self, redis) -> None:
        """Record a failed call. May open the circuit."""
        state = await self.get_state(redis)
        ttl = self.recovery_timeout * 10

        if state == self.HALF_OPEN:
            await redis.set(self._state_key, self.OPEN, ex=ttl)
            await redis.set(self._opened_at_key, str(time.time()), ex=ttl)
            logger.warning(
                "Circuit breaker HALF_OPEN → OPEN (test failed)",
                extra={"circuit": self.name},
            )
            return

        if state == self.CLOSED:
            failures = int(await redis.incr(self._failures_key))
            await redis.expire(self._failures_key, ttl)

            if failures >= self.failure_threshold:
                await redis.set(self._state_key, self.OPEN, ex=ttl)
                await redis.set(self._opened_at_key, str(time.time()), ex=ttl)
                logger.error(
                    "Circuit breaker OPEN after failure threshold reached",
                    extra={
                        "circuit": self.name,
                        "failures": failures,
                        "threshold": self.failure_threshold,
                    },
                )
