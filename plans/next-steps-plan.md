# Next Steps Plan

## Step 1: Commit Current Fix

The `json_repair.py` fix (empty array `[]` handling) needs to be committed.

## Step 2: Update Plan JSON & Project Status

The plan JSON has stale statuses. These need to be updated:

### Mark as completed in [`plan-ai-sourcing-hub-2026.json`](plan-ai-sourcing-hub-2026.json):
| Node ID | Current Status | New Status |
|---------|---------------|------------|
| `ai-supplier-auth-leaf4` | `"icon": "role"`, `"status": "pending"` | `"icon": "check"`, `"status": "completed"` |
| `ai-supplier-catalog-leaf1` | `"icon": "role"`, `"status": "pending"` | `"icon": "check"`, `"status": "completed"` |
| `ai-supplier-catalog-leaf2` | `"icon": "role"`, `"status": "pending"` | `"icon": "check"`, `"status": "completed"` |
| `ai-supplier-catalog-leaf3` | `"icon": "role"`, `"status": "pending"` | `"icon": "check"`, `"status": "completed"` |

### Update [`plans/current-project-status.md`](plans/current-project-status.md):
- Mark Supplier Digital Catalog as completed
- Mark Supplier Onboarding leaf4 as completed

## Step 3: Next Pending Feature

After the catalog, the remaining unstarted features in the plan are:

| Feature | ID | Status |
|---------|----|--------|
| Auto Translation | `ai-core-translate` | 🔵 Placeholder — no leaves defined |
| Chat / Negotiation Rooms | `ai-supplier-chat` | 🔵 Placeholder — no leaves defined |
| Escrow Payment System | `ai-ops-escrow` | 🔵 Placeholder — no leaves defined |
| System Monitoring | `ai-ops-monitoring` | 🔵 Partially implemented |
| User Management | `ai-ops-users` | 🔵 Partially implemented |

### Recommended Next Task: **Auto Translation Feature** (`ai-core-translate`)

**Rationale**: Translation is already partially built in the intake LLM client (`llm_client.py`), but there's no dedicated:
- Standalone translation page (Arabic ↔ Chinese ↔ English)
- Translation history/persistence
- Admin dashboard for translation quality monitoring

**Proposed Leaves**:

| Leaf | Description |
|------|-------------|
| leaf1 | Backend: Standalone translation endpoint `POST /api/v1/translate` with source/target language params |
| leaf2 | Frontend: Translation page with text areas for Arabic, Chinese, English |
| leaf3 | Backend: Translation history table + migration |
| leaf4 | Frontend: Translation history list with search/filter |
| leaf5 | Backend: Batch translation for catalog product descriptions |

### Alternative Next Task: **User Management UI** (`ai-ops-users`)

**Rationale**: The monitoring backend already has user listing/toggle endpoints. Could build a proper admin UI for managing users.

### Alternative Next Task: **System Monitoring Dashboard** (`ai-ops-monitoring`)

**Rationale**: Monitoring router and metrics exist. Could build a proper admin dashboard with charts/tables.

## Proposed Workflow

```
1. Code mode: git add + commit json_repair fix
2. Code mode: apply plan JSON updates (statuses & icons)
3. Code mode: update project-status.md
4. Architect: Discuss next feature choice with user
5. Code mode: Implement next feature → test → commit
```
