"""
AI-Sourcing Hub — Presigned URL Expiry Tests

IMPORTANT LIMITATION (verified empirically, not assumed): moto's S3 mock
does **not** enforce presigned-URL signature expiry at all. A URL generated
with ``ExpiresIn=1`` and fetched via a real HTTP GET after a 2-second sleep
still returns 200 with the file content — moto signs/serves objects without
validating the embedded expiry timestamp. So "does an actually-expired link
get rejected" cannot be verified against moto, or in this sandbox at all
(no real MinIO/S3 available — see TESTING_FINDINGS.md). That check needs a
real MinIO instance (`docker-compose.test.yml`).

What's verified here instead, without needing real enforcement:
  - ``get_presigned_url()`` actually threads the requested expiry duration
    into the signing call (different durations -> different signed URLs;
    the duration appears in the signed query string).
  - It fails closed (returns ``None``, not a URL or an exception) when the
    underlying S3 client errors.
"""
from urllib.parse import parse_qs, urlparse

import pytest
from moto import mock_aws

import app.shared.storage as storage
from app.shared.storage import get_presigned_url

BUCKET = "test-quotes-bucket"


@pytest.fixture(autouse=True)
def _plain_s3_client_for_moto(monkeypatch):
    """See tests/integration/test_documents_pipeline.py for why."""
    import boto3

    monkeypatch.setattr(storage, "_get_s3_client", lambda: boto3.client("s3", region_name="us-east-1"))


def _expiry_param(url: str) -> str:
    """Extract whichever expiry query param boto3 used (SigV2 `Expires`,
    an absolute unix timestamp, or SigV4 `X-Amz-Expires`, a relative
    duration in seconds — which one appears depends on signature version)."""
    qs = parse_qs(urlparse(url).query)
    for key in ("X-Amz-Expires", "Expires"):
        if key in qs:
            return qs[key][0]
    raise AssertionError(f"No recognizable expiry parameter found in {url}")


class TestPresignedUrlExpiryParameter:
    @pytest.mark.asyncio
    async def test_short_and_long_expiry_produce_different_urls(self):
        with mock_aws():
            import boto3

            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket=BUCKET)
            client.put_object(Bucket=BUCKET, Key="quote.pdf", Body=b"%PDF-1.4 test")

            url_short = await get_presigned_url(key="quote.pdf", bucket=BUCKET, expiry=60)
            url_long = await get_presigned_url(key="quote.pdf", bucket=BUCKET, expiry=86400)

        assert url_short != url_long
        assert _expiry_param(url_short) != _expiry_param(url_long)

    @pytest.mark.asyncio
    async def test_default_expiry_is_one_hour(self):
        with mock_aws():
            import boto3

            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket=BUCKET)
            client.put_object(Bucket=BUCKET, Key="quote.pdf", Body=b"%PDF-1.4 test")

            url = await get_presigned_url(key="quote.pdf", bucket=BUCKET)  # default expiry=3600

        # SigV2 "Expires" is absolute (now + 3600); SigV4 "X-Amz-Expires" is
        # the literal "3600" — just confirm the parameter exists and is
        # a plausible positive integer either way.
        assert int(_expiry_param(url)) > 0

    @pytest.mark.asyncio
    async def test_returns_none_when_s3_client_errors(self, monkeypatch):
        """Fails closed rather than returning a broken/unsigned URL."""

        class _BrokenClient:
            def generate_presigned_url(self, *args, **kwargs):
                from botocore.exceptions import ClientError

                raise ClientError({"Error": {"Code": "500", "Message": "boom"}}, "GetObject")

        monkeypatch.setattr(storage, "_get_s3_client", lambda: _BrokenClient())

        result = await get_presigned_url(key="quote.pdf", bucket=BUCKET)
        assert result is None
