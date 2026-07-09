from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class SupportIQError(Exception):
    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, status_code: int | None = None, code: str | None = None) -> None:
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.headers: dict = {}
        super().__init__(message)


class NotFoundException(SupportIQError):
    def __init__(self, resource: str, id: object = None) -> None:
        detail = f"{resource} not found" if id is None else f"{resource} '{id}' not found"
        super().__init__(detail, status.HTTP_404_NOT_FOUND, "not_found")


class ConflictException(SupportIQError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status.HTTP_409_CONFLICT, "conflict")


class BadRequestException(SupportIQError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status.HTTP_400_BAD_REQUEST, "bad_request")


class UnprocessableException(SupportIQError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, "unprocessable")


def _error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(SupportIQError)
    async def supportiq_error_handler(_: Request, exc: SupportIQError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message),
            headers=getattr(exc, "headers", {}),
        )

    @app.exception_handler(404)
    async def not_found_handler(_: Request, __: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=_error_body("not_found", "The requested resource does not exist"),
        )

    @app.exception_handler(500)
    async def internal_error_handler(_: Request, __: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("internal_error", "An unexpected error occurred"),
        )
