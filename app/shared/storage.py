"""
AI-Sourcing Hub — Object Storage Client (MinIO/S3)

Provides file storage operations for:
    - Uploaded documents (PDFs, images)
    - Generated quotation PDFs

Uses boto3 for S3-compatible storage (MinIO local, S3 in production).
"""

import io
import logging
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger("aisourcing.storage")

# ---- S3 Client Configuration ----
_s3_client_config = Config(
    max_pool_connections=20,
    connect_timeout=5,
    read_timeout=30,
    retries={"max_attempts": 3, "mode": "adaptive"},
)


def _get_s3_client():
    """Create and return a boto3 S3 client configured for MinIO or S3."""
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.MINIO_ENDPOINT}"
        if not settings.MINIO_SECURE
        else f"https://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=_s3_client_config,
        region_name="us-east-1",  # MinIO ignores this
    )


async def ensure_bucket(bucket_name: str) -> bool:
    """Ensure a bucket exists, creating it if necessary.

    Args:
        bucket_name: Name of the bucket to check/create.

    Returns:
        True if bucket exists or was created.
    """
    client = _get_s3_client()
    try:
        client.head_bucket(Bucket=bucket_name)
        logger.info("Bucket exists", extra={"bucket": bucket_name})
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            client.create_bucket(Bucket=bucket_name)
            logger.info("Bucket created", extra={"bucket": bucket_name})
            return True
        logger.error(
            "Bucket check failed",
            extra={"bucket": bucket_name, "error": str(e)},
        )
        return False


async def upload_file(
    file_bytes: bytes,
    key: str,
    content_type: str,
    bucket: Optional[str] = None,
) -> str:
    """Upload a file to object storage.

    Args:
        file_bytes: Raw file content.
        key: Object key/path (e.g., "documents/uuid/filename.pdf").
        content_type: MIME type of the file.
        bucket: Bucket name. Defaults to documents bucket.

    Returns:
        The object key (used for retrieval).
    """
    bucket = bucket or settings.STORAGE_BUCKET_DOCUMENTS
    client = _get_s3_client()
    try:
        client.upload_fileobj(
            io.BytesIO(file_bytes),
            bucket,
            key,
            ExtraArgs={
                "ContentType": content_type,
            },
        )
        logger.info(
            "File uploaded",
            extra={"bucket": bucket, "key": key, "content_type": content_type},
        )
        return key
    except ClientError as e:
        logger.error(
            "File upload failed",
            extra={"bucket": bucket, "key": key, "error": str(e)},
        )
        raise


async def get_presigned_url(
    key: str,
    bucket: Optional[str] = None,
    expiry: int = 3600,
) -> Optional[str]:
    """Generate a presigned URL for temporary file access.

    Args:
        key: Object key/path.
        bucket: Bucket name. Defaults to quotes bucket.
        expiry: URL expiry in seconds (default: 1 hour).

    Returns:
        Presigned URL string, or None if generation fails.
    """
    bucket = bucket or settings.STORAGE_BUCKET_QUOTES
    client = _get_s3_client()
    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiry,
        )
        return url
    except ClientError as e:
        logger.error(
            "Presigned URL generation failed",
            extra={"bucket": bucket, "key": key, "error": str(e)},
        )
        return None


async def delete_file(key: str, bucket: Optional[str] = None) -> bool:
    """Delete a file from object storage.

    Args:
        key: Object key/path to delete.
        bucket: Bucket name.

    Returns:
        True if deletion succeeded.
    """
    bucket = bucket or settings.STORAGE_BUCKET_DOCUMENTS
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=bucket, Key=key)
        logger.info("File deleted", extra={"bucket": bucket, "key": key})
        return True
    except ClientError as e:
        logger.error(
            "File deletion failed",
            extra={"bucket": bucket, "key": key, "error": str(e)},
        )
        return False


async def download_file(key: str, bucket: Optional[str] = None) -> Optional[bytes]:
    """Download a file from object storage.

    Args:
        key: Object key/path.
        bucket: Bucket name.

    Returns:
        File content as bytes, or None if not found.
    """
    bucket = bucket or settings.STORAGE_BUCKET_DOCUMENTS
    client = _get_s3_client()
    try:
        response = client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            logger.warning("File not found", extra={"bucket": bucket, "key": key})
            return None
        logger.error(
            "File download failed",
            extra={"bucket": bucket, "key": key, "error": str(e)},
        )
        return None
