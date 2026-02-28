"""CORS middleware — raw ASGI level, prevents proxy override."""
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi.responses import Response

ALLOWED_ORIGINS = {
    "https://cyclecoach.net",
    "https://www.cyclecoach.net",
    "https://cycle-insights-test.preview.emergentagent.com",
    "http://localhost:3000",
}


class StrictCORSMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode()

        # OPTIONS preflight — respond immediately, bypass everything
        if scope["method"] == "OPTIONS" and origin in ALLOWED_ORIGINS:
            response = Response(
                status_code=204,
                headers={
                    "access-control-allow-origin": origin,
                    "access-control-allow-credentials": "true",
                    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS,PATCH",
                    "access-control-allow-headers": "Content-Type,Authorization,Cookie,X-Requested-With",
                    "access-control-max-age": "600",
                },
            )
            await response(scope, receive, send)
            return

        # For normal requests, intercept the response to inject/overwrite CORS headers
        async def send_with_cors(message):
            if message["type"] == "http.response.start" and origin in ALLOWED_ORIGINS:
                # Filter out any proxy-injected CORS headers
                raw_headers = [
                    (k, v) for k, v in message.get("headers", [])
                    if not k.lower().startswith(b"access-control-")
                ]
                # Add our own
                raw_headers.extend([
                    (b"access-control-allow-origin", origin.encode()),
                    (b"access-control-allow-credentials", b"true"),
                    (b"access-control-allow-methods", b"GET,POST,PUT,DELETE,OPTIONS,PATCH"),
                    (b"access-control-allow-headers", b"Content-Type,Authorization,Cookie,X-Requested-With"),
                    (b"vary", b"Origin"),
                ])
                message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_with_cors)
