"""
Audit middleware — append-only trail of PHI access and changes.

Logs metadata only (never request/response bodies) so the trail holds no PHI:
- every authenticated mutating API call (POST/PUT/PATCH/DELETE)
- reads of explicitly sensitive endpoints (client profiles, intake forms)

Designed to never break a request: any failure while logging is swallowed.
"""
import re

# PHI-bearing paths whose *reads* (GET) we record. Writes are always recorded.
SENSITIVE_READ_PATTERNS = (
    re.compile(r"^/api/clients/\d+/profile/"),
    re.compile(r"^/api/public/intake/"),
    re.compile(r"^/api/soap-notes/"),
    re.compile(r"^/api/intake-responses/"),
)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _resource_and_ref(path: str):
    # /api/clients/12/profile/ -> ("clients", "12")
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "api":
        resource = parts[1]
        ref = parts[2] if len(parts) >= 3 and parts[2].isdigit() else ""
        return resource[:120], ref[:64]
    return path[:120], ""


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._maybe_log(request, response)
        except Exception:  # never let auditing break a response
            pass
        return response

    def _maybe_log(self, request, response):
        path = request.path
        if not path.startswith("/api/"):
            return

        method = request.method
        is_write = method in WRITE_METHODS
        is_sensitive_read = method == "GET" and any(p.match(path) for p in SENSITIVE_READ_PATTERNS)
        if not (is_write or is_sensitive_read):
            return

        # Skip pure auth-token plumbing (no PHI) to keep the trail focused.
        if path.startswith("/api/auth/token"):
            return

        from .models import AuditLog

        user = getattr(request, "user", None)
        actor = user if (user and user.is_authenticated) else None
        resource, object_ref = _resource_and_ref(path)

        AuditLog.objects.create(
            actor=actor,
            actor_email=(getattr(actor, "email", "") or getattr(actor, "username", "")) if actor else "",
            action=method,
            resource=resource,
            path=path[:255],
            object_ref=object_ref,
            status_code=getattr(response, "status_code", 0) or 0,
            ip_address=_client_ip(request),
        )
