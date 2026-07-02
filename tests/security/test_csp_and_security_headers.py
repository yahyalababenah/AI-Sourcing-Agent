"""
AI-Sourcing Hub — CSP & Security Header Value Tests

``tests/test_output/test_security_middleware.py`` already checks that every
security header is *present*. This file checks the actual *values* — in
particular, per the brief: document whether ``unsafe-inline`` is still used.

Finding: it is — ``style-src 'self' 'unsafe-inline'`` (security_middleware.py:82).
``script-src`` is NOT relaxed (`'self'` only, no unsafe-inline/unsafe-eval),
which is the security-relevant half — inline `<script>` injection is blocked;
inline `style=""` attributes are allowed (a real but narrower attack surface,
typically accepted for utility-CSS frameworks like Tailwind).
"""
import pytest

from app.shared.security_middleware import _get_security_headers


class TestCSPDirectiveValues:
    def test_unsafe_inline_is_present_in_style_src_only(self):
        """Documents the current tradeoff explicitly, per the brief."""
        csp = _get_security_headers()["Content-Security-Policy"]
        directives = {d.split()[0]: d for d in csp.split("; ")}

        assert "'unsafe-inline'" in directives["style-src"]
        assert "'unsafe-inline'" not in directives.get("script-src", "")
        assert "'unsafe-eval'" not in directives.get("script-src", "")

    def test_script_src_restricted_to_self(self):
        csp = _get_security_headers()["Content-Security-Policy"]
        assert "script-src 'self'" in csp

    def test_default_src_restricted_to_self(self):
        csp = _get_security_headers()["Content-Security-Policy"]
        assert csp.startswith("default-src 'self'")

    def test_frame_ancestors_none_blocks_clickjacking(self):
        csp = _get_security_headers()["Content-Security-Policy"]
        assert "frame-ancestors 'none'" in csp

    def test_form_action_restricted_to_self(self):
        csp = _get_security_headers()["Content-Security-Policy"]
        assert "form-action 'self'" in csp

    def test_connect_src_restricted_to_self(self):
        """No wildcard connect-src — prevents exfiltration to arbitrary hosts
        via fetch()/XHR/WebSocket from a compromised page."""
        csp = _get_security_headers()["Content-Security-Policy"]
        assert "connect-src 'self'" in csp
        assert "connect-src *" not in csp


class TestOtherSecurityHeaderValues:
    def test_x_content_type_options_nosniff(self):
        assert _get_security_headers()["X-Content-Type-Options"] == "nosniff"

    def test_x_frame_options_deny(self):
        assert _get_security_headers()["X-Frame-Options"] == "DENY"

    def test_x_xss_protection_disabled_not_enabled(self):
        """`1; mode=block` is the legacy (and exploitable-via-XSS-auditor-bugs)
        setting; `0` explicitly disables the deprecated XSS auditor, which is
        the modern recommended value — document which one this app uses."""
        assert _get_security_headers()["X-XSS-Protection"] == "0"

    def test_referrer_policy_restricts_cross_origin_leakage(self):
        value = _get_security_headers()["Referrer-Policy"]
        assert value == "strict-origin-when-cross-origin"

    def test_permissions_policy_disables_sensitive_apis(self):
        value = _get_security_headers()["Permissions-Policy"]
        for api in ["camera", "microphone", "geolocation", "payment", "usb"]:
            assert f"{api}=()" in value, f"{api} should be disabled by Permissions-Policy"


@pytest.mark.asyncio
class TestHeadersOnRealResponses:
    """Confirms the middleware actually attaches these headers to real HTTP
    responses, not just that the header-building function returns them."""

    async def test_headers_present_on_unauthenticated_response(self, client):
        resp = await client.get("/api/v1/admin/stats")  # 401, still gets headers
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"
        assert "content-security-policy" in resp.headers

    async def test_headers_present_on_successful_response(self, client, make_user):
        from app.modules.auth.service import _create_access_token

        agent = await make_user(role="agent")
        resp = await client.get(
            "/api/v1/catalog/products/pending",
            headers={"Authorization": f"Bearer {_create_access_token(str(agent.id))}"},
        )
        assert resp.status_code == 200
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert "'unsafe-inline'" in resp.headers.get("content-security-policy", "")

    async def test_headers_present_on_404_response(self, client, make_user):
        from app.modules.auth.service import _create_access_token

        agent = await make_user(role="agent")
        resp = await client.get(
            "/api/v1/intake/rfqs/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {_create_access_token(str(agent.id))}"},
        )
        assert resp.status_code == 404
        assert resp.headers.get("x-frame-options") == "DENY"
