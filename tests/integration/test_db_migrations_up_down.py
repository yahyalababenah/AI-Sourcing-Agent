"""
AI-Sourcing Hub — Alembic Migration Chain Tests

The brief asks for ``alembic upgrade head`` -> ``downgrade base`` ->
``upgrade head`` again against a real empty database. That isn't runnable in
this sandbox: ``alembic/env.py`` builds its URL from ``settings.db_url``
(same broken-import-order issue as TESTING_FINDINGS.md #3b — it never picks
up this suite's SQLite override), and even if it did, several migrations use
genuinely PostgreSQL-only DDL (native ENUM types, the CatalogProduct GIN/tsvector
trigger) that can't run against SQLite regardless. Actually running the
up/down/up cycle needs a real PostgreSQL instance — `docker-compose.test.yml`
or CI's Postgres service container, not the default test DB.

What's tested here instead, without needing any DB connection at all (pure
static analysis of the migration files via Alembic's ``ScriptDirectory``):
  - Exactly one head revision (no branching/forked migration history).
  - Every migration has both ``upgrade()`` and ``downgrade()`` defined —
    a migration with no downgrade can never be part of an up/down/up cycle,
    so this is the one reversibility guarantee checkable offline.
  - The revision chain from base to head is unbroken (no missing
    ``down_revision`` links) — `walk_revisions()` raises if it can't resolve
    the full chain, so successfully enumerating all migrations proves this.
"""
import inspect

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory


@pytest.fixture(scope="module")
def script_directory() -> ScriptDirectory:
    cfg = Config("alembic.ini")
    return ScriptDirectory.from_config(cfg)


class TestMigrationChainIntegrity:
    def test_exactly_one_head(self, script_directory):
        heads = script_directory.get_heads()
        assert len(heads) == 1, f"Expected a single head, found {len(heads)}: {heads}"

    def test_chain_is_fully_walkable_from_base_to_head(self, script_directory):
        """walk_revisions() itself raises if any down_revision link is
        missing/broken, so successfully collecting all of them proves the
        chain is intact. Also confirms exactly one base (down_revision=None)."""
        revisions = list(script_directory.walk_revisions())
        assert len(revisions) == 15

        bases = [r for r in revisions if r.down_revision is None]
        assert len(bases) == 1

    def test_every_migration_defines_upgrade_and_downgrade(self, script_directory):
        missing_upgrade = []
        missing_downgrade = []
        for rev in script_directory.walk_revisions():
            module = rev.module
            if not hasattr(module, "upgrade") or not inspect.isfunction(module.upgrade):
                missing_upgrade.append(rev.revision)
            if not hasattr(module, "downgrade") or not inspect.isfunction(module.downgrade):
                missing_downgrade.append(rev.revision)

        assert missing_upgrade == [], f"Migrations missing upgrade(): {missing_upgrade}"
        assert missing_downgrade == [], f"Migrations missing downgrade(): {missing_downgrade}"

    def test_no_duplicate_revision_ids(self, script_directory):
        revisions = [rev.revision for rev in script_directory.walk_revisions()]
        assert len(revisions) == len(set(revisions))
