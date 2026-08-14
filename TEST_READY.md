# E2E Test Suite Ready

The 4-tier opaque-box E2E test suite for the Estádio Municipal de Leiria Maintenance PWA is fully implemented, configured, and verified.

---

## Test Execution

To execute the test suite:

```bash
cd c:\dev\estadio\maintenance_app
npm run test:e2e
```

*Alternative command:*
```bash
npx playwright test
```

---

## Coverage Summary Table

| Tier | Name / Scope | Test File | Test Cases Count | Status |
|------|--------------|-----------|------------------|--------|
| **Tier 1** | Core Feature Verification | `tests/e2e/tier1-features.spec.ts` | 20 | Ready |
| **Tier 2** | Boundary & Edge Case Testing | `tests/e2e/tier2-boundaries.spec.ts` | 7 | Ready |
| **Tier 3** | Cross-Feature Interactions | `tests/e2e/tier3-interactions.spec.ts` | 5 | Ready |
| **Tier 4** | Stadium Operational Scenarios | `tests/e2e/tier4-stadium-scenarios.spec.ts` | 2 | Ready |
| **Total** | **Full E2E Suite** | **`tests/e2e/*.spec.ts`** | **34** | **Ready** |

*Note: All 34 test cases execute across configured mobile viewports (Pixel 5 and iPhone 13).*

---

## Feature Checklist Mapping (`PROJECT.md § Feature Inventory`)

| # | Feature | Target Scope | E2E Test Coverage | Spec Location |
|---|---------|--------------|-------------------|---------------|
| **1** | PWA Shell & Theme | Service Worker precaching, Web Manifest, Navy/Gold design system | `T1.1` (App load & greeting), `T1.2` (Online badge), `T1.15` (Offline badge) | `tier1-features.spec.ts` |
| **2** | Offline IndexedDB Engine | Dexie.js database schema for reports, locations, sync queue | `T1.5` (Report storage), `T1.16` (Offline report), `T1.17` (Offline location), `T3.1`-`T3.5` (IndexedDB transactions), `T4.1`, `T4.2` | `tier1-features.spec.ts`, `tier3-interactions.spec.ts`, `tier4-stadium-scenarios.spec.ts` |
| **3** | Dynamic Locations Precaching | Seed default stadium locations, local caching, location selector | `T1.3` (Pre-cached dropdown loading), `T4.1` (Admin office boot loading) | `tier1-features.spec.ts`, `tier4-stadium-scenarios.spec.ts` |
| **4** | Offline Dynamic Location Creation | Add new location offline with local persistence & queueing | `T1.17` (Add custom location), `T1.18` (Select custom location), `T2.5` (50 custom locations stress), `T3.1`, `T3.5`, `T4.1`, `T4.2` | `tier1-features.spec.ts`, `tier2-boundaries.spec.ts`, `tier3-interactions.spec.ts`, `tier4-stadium-scenarios.spec.ts` |
| **5** | Report Field Capture | Capture Date/Time, Location, Description, Time Spent, Photos, Materials | `T1.5` (Valid fields), `T1.7` (Materials & tools), `T1.12` (Photo attach), `T1.13` (Multiple photos), `T2.2` (10k char text), `T2.7` (Numeric boundary), `T4.1`, `T4.2` | `tier1-features.spec.ts`, `tier2-boundaries.spec.ts`, `tier4-stadium-scenarios.spec.ts` |
| **6** | Canvas Photo Compression | Downscale camera uploads to max 1280px JPEG Blobs | `T1.12` (Thumbnail preview), `T1.14` (Full-size gallery), `T2.1` (5MB photo canvas downscale), `T2.6` (Invalid PDF block), `T3.5`, `T4.1`, `T4.2` | `tier1-features.spec.ts`, `tier2-boundaries.spec.ts`, `tier3-interactions.spec.ts`, `tier4-stadium-scenarios.spec.ts` |
| **7** | Non-Technical Mobile CRUD UI | Dashboard feed, Report Creator, Report Detail/Editor, Delete Confirmation | `T1.4` (Open modal), `T1.6` (Feed top card), `T1.8` (Detail modal), `T1.9` (Edit report), `T1.10` (Delete confirm modal), `T1.11` (Soft-delete feed removal), `T1.20` (Search/filter feed), `T2.4` (Validation toasts) | `tier1-features.spec.ts`, `tier2-boundaries.spec.ts` |
| **8** | Cloud Sync Engine & Offline Queue | Queue offline mutations, auto-sync on reconnect, status badges | `T1.16` (Pending status badge), `T1.19` (Auto-sync badge update), `T2.3` (Mid-submit network drop queue fallback), `T3.1`-`T3.5` (Queue ordering & LWW conflict resolution), `T4.1`, `T4.2` | `tier1-features.spec.ts`, `tier2-boundaries.spec.ts`, `tier3-interactions.spec.ts`, `tier4-stadium-scenarios.spec.ts` |
| **9** | Dual Cloud Provider | `CloudStorageProvider` interface with `MockCloudProvider` & Firebase stub | `T1.19` (Cloud push verification), `T3.1`-`T3.5` (Mock sync endpoint verification), `T4.1`, `T4.2` | `tier1-features.spec.ts`, `tier3-interactions.spec.ts`, `tier4-stadium-scenarios.spec.ts` |
| **10** | E2E Opaque-Box Test Suite | Playwright mobile E2E suite covering Tiers 1-4 | `T1.1` - `T4.2` (Full suite pass verification) | All `tests/e2e/*.spec.ts` files |

---

## Detailed Test Suite Inventory

### Tier 1: Core Feature Verification (`tests/e2e/tier1-features.spec.ts`)
- `T1.1`: App load & header greeting ("Olá, João")
- `T1.2`: Connectivity badge online status (green dot, "Online")
- `T1.3`: Pre-cached locations loading in dropdown
- `T1.4`: Report creator modal opening via `#btn-new-report`
- `T1.5`: Create report with valid fields
- `T1.6`: Verify report appears at top of feed
- `T1.7`: Create report with optional materials & tools
- `T1.8`: Open report detail modal
- `T1.9`: Edit report description & time spent
- `T1.10`: Soft-delete report & confirmation dialog
- `T1.11`: Verify deleted report removed from feed
- `T1.12`: Attach photo (`sample_before.jpg`) & render thumbnail preview
- `T1.13`: Attach multiple photos (before/after)
- `T1.14`: Render full-size gallery in detail modal
- `T1.15`: Switch network offline -> connectivity badge updates to yellow "Offline"
- `T1.16`: Create report offline -> status badge "Pendente"
- `T1.17`: Add dynamic custom location offline via "+ Nova Localização"
- `T1.18`: Select custom location in report form offline
- `T1.19`: Switch network online -> auto-sync executes & card badge updates to "Sincronizado"
- `T1.20`: Search/filter dashboard feed by location

### Tier 2: Boundary & Edge Case Testing (`tests/e2e/tier2-boundaries.spec.ts`)
- `T2.1`: Large photo compression (>5MB canvas downscale to max 1280px)
- `T2.2`: 10,000-character description field input & persistence & UI truncation
- `T2.3`: Network drop mid-submit fallback to sync queue without data loss
- `T2.4`: Empty required fields validation error toasts
- `T2.5`: High volume custom locations (50 locations) dropdown performance/search
- `T2.6`: Invalid file upload (.pdf) error toast
- `T2.7`: Invalid numeric input (-30 min) validation block

### Tier 3: Cross-Feature Interactions (`tests/e2e/tier3-interactions.spec.ts`)
- `T3.1`: Offline location + report dependency sync ordering
- `T3.2`: Offline edit + soft-delete pre-sync cycle
- `T3.3`: Multi-report queue flushes (5 offline reports synced chronologically)
- `T3.4`: Last-Write-Wins (LWW) conflict handling using ISO timestamps
- `T3.5`: Combined multi-entity single offline session atomic sync

### Tier 4: Stadium Operational Scenarios (`tests/e2e/tier4-stadium-scenarios.spec.ts`)
- `T4.1`: Scenario 1 — Morning Pitch Inspection (Relvado Principal)
- `T4.2`: Scenario 2 — Emergency Evening Floodlight Repair (Torres de Iluminação)
