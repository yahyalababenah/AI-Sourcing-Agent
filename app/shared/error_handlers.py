"""
AI-Sourcing Hub — Global Exception Handlers

Registers FastAPI exception handlers that return standardized JSON error responses.

Error response format:
    {
        "error": {
            "code": "RFQ_NOT_FOUND",
            "message": "RFQ with ID 'xyz-123' not found",
            "details": {},
            "request_id": "req-abc-456"
        }
    }
"""

import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.shared.exceptions import AppException


def _get_request_id(request: Request) -> str:
    """Extract or generate a request ID for tracing."""
    request_id = request.headers.get("X-Request-ID")
    if not request_id:
        request_id = str(uuid.uuid4())[:8]
    return request_id


def _build_error_response(
    request: Request,
    code: str,
    message: str,
    status_code: int,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    """Build a standardized error JSON response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": _get_request_id(request),
            }
        },
    )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle all custom AppException subclasses."""
    return _build_error_response(
        request=request,
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handle Pydantic/FastAPI validation errors."""
    errors = []
    for err in exc.errors():
        errors.append(
            {
                "field": ".".join(str(l) for l in err.get("loc", [])),
                "message": err.get("msg", ""),
                "type": err.get("type", ""),
            }
        )
    return _build_error_response(
        request=request,
        code="VALIDATION_ERROR",
        message="Request validation failed",
        status_code=422,
        details={"errors": errors},
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Handle standard HTTP exceptions."""
    code_map = {
        401: "AUTH_INVALID",
        403: "AUTH_FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        429: "RATE_LIMITED",
    }
    return _build_error_response(
        request=request,
        code=code_map.get(exc.status_code, f"HTTP_{exc.status_code}"),
        message=str(exc.detail),
        status_code=exc.status_code,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions (500)."""
    # Log the full traceback for debugging
    import logging
    logger = logging.getLogger("aisourcing")
    logger.exception("Unhandled exception: %s", exc)
    return _build_error_response(
        request=request,
        code="INTERNAL_ERROR",
        message="An unexpected error occurred",
        status_code=500,
    )


def register_error_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the FastAPI app.

    Must be called during app initialization.
    """
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
