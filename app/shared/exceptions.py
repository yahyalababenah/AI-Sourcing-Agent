"""
AI-Sourcing Hub — Custom Exception Classes

All business-logic exceptions inherit from AppException.
Each exception has:
    - code: Machine-readable error code (e.g., "RFQ_NOT_FOUND")
    - message: Human-readable description
    - status_code: HTTP status code
    - details: Optional additional context
"""

from typing import Any, Optional


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: Optional[dict[str, Any]] = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


# ---- 4xx Client Errors ----

class NotFoundException(AppException):
    """Resource not found."""

    def __init__(
        self,
        resource: str = "Resource",
        resource_id: str = "",
        details: Optional[dict[str, Any]] = None,
    ):
        code = f"{resource.upper()}_NOT_FOUND"
        message = f"{resource} with ID '{resource_id}' not found"
        super().__init__(
            code=code,
            message=message,
            status_code=404,
            details=details,
        )


class AuthenticationError(AppException):
    """Authentication failure."""

    def __init__(
        self,
        message: str = "Invalid authentication credentials",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="AUTH_INVALID",
            message=message,
            status_code=401,
            details=details,
        )


class AuthorizationError(AppException):
    """Permission denied."""

    def __init__(
        self,
        message: str = "Insufficient permissions",
        required_role: str = "",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="AUTH_FORBIDDEN",
            message=message,
            status_code=403,
            details={"required_role": required_role, **(details or {})},
        )


class ValidationError(AppException):
    """Request validation failure."""

    def __init__(
        self,
        message: str = "Validation failed",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=422,
            details=details,
        )


class RateLimitError(AppException):
    """Rate limit exceeded."""

    def __init__(
        self,
        message: str = "Rate limit exceeded. Please try again later.",
        retry_after: int = 60,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="RATE_LIMITED",
            message=message,
            status_code=429,
            details={"retry_after_seconds": retry_after, **(details or {})},
        )


# ---- Business Logic Errors ----

class DocumentProcessingError(AppException):
    """Document processing failure."""

    def __init__(
        self,
        message: str = "Document processing failed",
        document_id: str = "",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="DOCUMENT_PROCESSING_FAILED",
            message=message,
            status_code=500,
            details={"document_id": document_id, **(details or {})},
        )


class PricingCalculationError(AppException):
    """Pricing calculation failure."""

    def __init__(
        self,
        message: str = "Pricing calculation failed",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="PRICING_CALCULATION_FAILED",
            message=message,
            status_code=500,
            details=details,
        )


class QuoteGenerationError(AppException):
    """Quotation generation failure."""

    def __init__(
        self,
        message: str = "Quotation generation failed",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="QUOTE_GENERATION_FAILED",
            message=message,
            status_code=500,
            details=details,
        )


class IncompleteExtractionError(AppException):
    """LLM returned incomplete entity extraction."""

    def __init__(
        self,
        message: str = "Could not extract complete information from the input text",
        missing_fields: Optional[list[str]] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="INCOMPLETE_EXTRACTION",
            message=message,
            status_code=422,
            details={"missing_fields": missing_fields or [], **(details or {})},
        )


class ProviderUnavailableError(AppException):
    """LLM/VLM provider is unavailable (rate limited, down, etc.)."""

    def __init__(
        self,
        provider: str = "unknown",
        message: str = "AI provider is currently unavailable",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            code="PROVIDER_UNAVAILABLE",
            message=message,
            status_code=503,
            details={"provider": provider, **(details or {})},
        )
