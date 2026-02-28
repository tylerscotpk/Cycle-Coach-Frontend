"""CORS middleware — raw ASGI level, echoes exact origin for credentialed requests."""
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi.responses import Response

ALLOWED_ORIGINS = {
    "https://cyclecoach.net",
    "https://www.cyclecoach.net",
    "https://cycle-insights-test.preview.emergentagent.com",
    "http://localhost:3000",
}

CORS_HEADERS = [
    (b"access-control-allow-credentials", b"true"),
    (b"access-control-allow-methods", b"GET,POST,PUT,DELETE,OPTIONS,PATCH"),
    (b"access-control-allow-headers", b"Content-Type,Authorization,Cookie,X-Requested-With"),
    (b"vary", b"Origin"),
]


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

        is_allowed = origin in ALLOWED_ORIGINS

        # OPTIONS preflight — always respond, even for disallowed origins (with no CORS headers)
        if scope["method"] == "OPTIONS":
            if is_allowed:
                resp = Response(
                    status_code=204,
                    headers={
                        "access-control-allow-origin": origin,
                        "access-control-allow-credentials": "true",
                        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS,PATCH",
                        "access-control-allow-headers": "Content-Type,Authorization,Cookie,X-Requested-With",
                        "access-control-max-age": "600",
                    },
                )
            else:
                resp = Response(status_code=204)
            await resp(scope, receive, send)
            return

        # Normal requests — inject CORS headers on every response
        async def send_with_cors(message):
            if message["type"] == "http.response.start":
                # Strip any proxy-injected CORS headers
                raw_headers = [
                    (k, v) for k, v in message.get("headers", [])
                    if not k.lower().startswith(b"access-control-")
                ]
                if is_allowed:
                    raw_headers.append((b"access-control-allow-origin", origin.encode()))
                    raw_headers.extend(CORS_HEADERS)
                message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_with_cors)
