#!/usr/bin/env bash
# =============================================================================
# AI-Sourcing Hub — Daily Backup Script
#
# What it does:
#   1. Dumps PostgreSQL to a compressed .sql.gz file
#   2. Uploads the dump to MinIO under backups/postgres/YYYY-MM-DD/
#   3. Mirrors MinIO documents bucket to backups/minio-mirror/
#   4. Prunes backups older than RETAIN_DAYS (default: 30)
#
# Dependencies (must be available in PATH):
#   - pg_dump (postgresql-client)
#   - mc     (MinIO Client — https://min.io/docs/minio/linux/reference/minio-mc.html)
#   - gzip
#
# Environment variables (set in .env or pass on the command line):
#   DB_USER           PostgreSQL user       (default: postgres)
#   DB_HOST           PostgreSQL host       (default: localhost)
#   DB_PORT           PostgreSQL port       (default: 5432)
#   DB_NAME           Database name         (default: aisourcing)
#   PGPASSWORD        PostgreSQL password   (required)
#   MINIO_ALIAS       mc alias name         (default: local)
#   MINIO_BUCKET      Source bucket         (default: aisourcing)
#   BACKUP_BUCKET     Backup bucket         (default: aisourcing-backups)
#   RETAIN_DAYS       Days to keep backups  (default: 30)
#
# Usage:
#   # Add to cron (runs daily at 02:00):
#   0 2 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1
#
#   # Or run manually:
#   PGPASSWORD=secret ./scripts/backup.sh
# =============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-aisourcing}"
MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_BUCKET="${MINIO_BUCKET:-aisourcing}"
BACKUP_BUCKET="${BACKUP_BUCKET:-aisourcing-backups}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%S)
DUMP_FILE="/tmp/aisourcing_${DATE}.sql.gz"

# ── Logging helper ─────────────────────────────────────────────────────────────
log() {
    echo "[${TIMESTAMP}] $*"
}

# ── Guard: required vars ───────────────────────────────────────────────────────
if [[ -z "${PGPASSWORD:-}" ]]; then
    echo "ERROR: PGPASSWORD environment variable is not set." >&2
    exit 1
fi

# ── 1. PostgreSQL dump ─────────────────────────────────────────────────────────
log "Starting PostgreSQL backup: ${DB_NAME} → ${DUMP_FILE}"

pg_dump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --no-password \
    --format=plain \
    --no-owner \
    --no-acl \
    "${DB_NAME}" \
  | gzip > "${DUMP_FILE}"

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
log "Dump created: ${DUMP_FILE} (${DUMP_SIZE})"

# ── 2. Upload dump to MinIO ────────────────────────────────────────────────────
REMOTE_PATH="${MINIO_ALIAS}/${BACKUP_BUCKET}/postgres/${DATE}/aisourcing_${DATE}.sql.gz"
log "Uploading dump to MinIO: ${REMOTE_PATH}"

mc cp "${DUMP_FILE}" "${REMOTE_PATH}"
log "Dump uploaded successfully"

# Clean up local temp file
rm -f "${DUMP_FILE}"

# ── 3. Mirror documents bucket ─────────────────────────────────────────────────
log "Mirroring documents bucket: ${MINIO_ALIAS}/${MINIO_BUCKET} → ${MINIO_ALIAS}/${BACKUP_BUCKET}/minio-mirror/"

mc mirror \
    --overwrite \
    --remove \
    "${MINIO_ALIAS}/${MINIO_BUCKET}" \
    "${MINIO_ALIAS}/${BACKUP_BUCKET}/minio-mirror/"

log "Mirror complete"

# ── 4. Prune old PostgreSQL backups ───────────────────────────────────────────
log "Pruning backups older than ${RETAIN_DAYS} days from ${BACKUP_BUCKET}/postgres/"

CUTOFF_DATE=$(date -d "-${RETAIN_DAYS} days" +%Y-%m-%d)

# List backup date directories and remove those older than the cutoff
mc ls "${MINIO_ALIAS}/${BACKUP_BUCKET}/postgres/" 2>/dev/null \
  | awk '{print $NF}' \
  | tr -d '/' \
  | while read -r dir_date; do
      if [[ "${dir_date}" < "${CUTOFF_DATE}" ]]; then
          log "Removing old backup: postgres/${dir_date}/"
          mc rm --recursive --force "${MINIO_ALIAS}/${BACKUP_BUCKET}/postgres/${dir_date}/" \
            && log "Removed: postgres/${dir_date}/" \
            || log "WARNING: Failed to remove postgres/${dir_date}/"
      fi
  done

log "Backup job complete (date: ${DATE})"
