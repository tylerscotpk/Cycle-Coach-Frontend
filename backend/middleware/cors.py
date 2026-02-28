"""CORS middleware — raw ASGI level, echoes exact origin for credentialed requests."""
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi.responses import Response

ALLOWED_ORIGINS = {
    "https://cyclecoach.net",
    "https://www.cyclecoach.net",
    "https://partner-guide-4.preview.emergentagent.com",
    "http://localhost:3000",
}

CORS_METHODS = "GET,POST,PUT,DELETE,OPTIONS,PATCH"
CORS_HEADERS = "Content-Type,Authorization,Cookie,X-Requested-With"


def _origin_allowed(origin: str) -> bool:
    """Check if origin is in the allowlist (normalized, no trailing slash)."""
    if not origin:
        return False
    return origin.rstrip("/") in ALLOWED_ORIGINS


class StrictCORSMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_list = scope.get("headers", [])
        origin = ""
        for k, v in headers_list:
            if k == b"origin":
                origin = v.decode()
                break

        is_allowed = _origin_allowed(origin)

        # OPTIONS preflight
        if scope["method"] == "OPTIONS":
            resp_headers = {}
            if is_allowed:
                resp_headers = {
                    "access-control-allow-origin": origin,
                    "access-control-allow-credentials": "true",
                    "access-control-allow-methods": CORS_METHODS,
                    "access-control-allow-headers": CORS_HEADERS,
                    "access-control-max-age": "600",
                    "vary": "Origin",
                }
            resp = Response(status_code=204, headers=resp_headers)
            await resp(scope, receive, send)
            return

        # Normal requests — inject CORS headers into every response
        async def send_with_cors(message):
            if message["type"] == "http.response.start" and is_allowed:
                raw_headers = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if not k.lower().startswith(b"access-control-")
                    and k.lower() != b"vary"
                ]
                raw_headers.append((b"access-control-allow-origin", origin.encode()))
                raw_headers.append((b"access-control-allow-credentials", b"true"))
                raw_headers.append((b"access-control-allow-methods", CORS_METHODS.encode()))
                raw_headers.append((b"access-control-allow-headers", CORS_HEADERS.encode()))
                raw_headers.append((b"vary", b"Origin"))
                message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_with_cors)
