"""CORS middleware — raw ASGI level, echoes exact origin for credentialed requests."""
import os
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi.responses import Response

_cors_env = os.environ.get("CORS_ORIGINS", "*")
if _cors_env.strip() == "*":
    ALLOW_ALL = True
    ALLOWED_ORIGINS = set()
else:
    ALLOW_ALL = False
    ALLOWED_ORIGINS = {o.strip().rstrip("/") for o in _cors_env.split(",") if o.strip()}

CORS_METHODS = "GET,POST,PUT,DELETE,OPTIONS,PATCH"
CORS_HEADERS = "Content-Type,Authorization,Cookie,X-Requested-With"


def _origin_allowed(origin: str) -> bool:
    if not origin:
        return ALLOW_ALL
    return ALLOW_ALL or origin.rstrip("/") in ALLOWED_ORIGINS


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

        # Use wildcard when ALLOW_ALL, otherwise echo exact origin
        allow_origin_value = b"*" if ALLOW_ALL else origin.encode()

        # OPTIONS preflight
        if scope["method"] == "OPTIONS":
            resp_headers = {}
            if is_allowed:
                resp_headers = {
                    "access-control-allow-origin": allow_origin_value.decode() if isinstance(allow_origin_value, bytes) else allow_origin_value,
                    "access-control-allow-methods": CORS_METHODS,
                    "access-control-allow-headers": CORS_HEADERS,
                    "access-control-max-age": "600",
                    "vary": "Origin",
                }
                if not ALLOW_ALL:
                    resp_headers["access-control-allow-credentials"] = "true"
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
                raw_headers.append((b"access-control-allow-origin", allow_origin_value))
                raw_headers.append((b"access-control-allow-methods", CORS_METHODS.encode()))
                raw_headers.append((b"access-control-allow-headers", CORS_HEADERS.encode()))
                raw_headers.append((b"vary", b"Origin"))
                if not ALLOW_ALL:
                    raw_headers.append((b"access-control-allow-credentials", b"true"))
                message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_with_cors)
