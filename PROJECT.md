# Project: Estádio Municipal de Leiria — Maintenance PWA (`maintenance_app`)

> **Goal**: Build an intuitive, offline-first Progressive Web App for daily stadium maintenance reporting with CRUD, dynamic pre-cached locations, cloud sync, and premium navy/gold native UI.

---

## Architecture

- **Stack**: Vite + Vanilla JavaScript (ES2022) + HTML5 + CSS3.
- **Offline Storage**: Dexie.js (IndexedDB wrapper) managing `reports`, `locations`, and `sync_queue` object stores.
- **PWA Service Worker**: Custom `sw.js` with Stale-While-Revalidate caching for app shell static assets + `manifest.webmanifest`.
- **Photo Engine**: Client-side HTML5 Canvas compression (max 1280px, JPEG quality 0.75, ~180KB Blobs in IndexedDB).
- **Cloud Sync Protocol**: Local-first mutation queue (`sync_queue`), background auto-sync triggered on `online` window event, Last-Write-Wins (LWW) timestamp logic, and dual provider support (`MockCloudProvider` + `FirebaseCloudProvider`).
- **UI Aesthetic**: "mmcrespo" signature design. Deep Navy headers (`#0B132B`), Gold accents (`#C5A059`), White rounded cards (`#FFFFFF`, radius 20px), large touch targets (≥48px), sticky CTAs (56px), and CSS native slide/fade transitions.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | PWA Shell & Theme | Service Worker precaching, Web Manifest, Navy/Gold design system, native CSS transitions | M1 | R3, R5 |
| 2 | Offline IndexedDB Engine | Dexie.js database schema for reports, locations, and sync queue | M1 | R3 |
| 3 | Dynamic Locations Precaching | Seed default stadium locations, local caching, location selector UI | M2 | R4 |
| 4 | Offline Dynamic Location Creation | Add new stadium location offline with local persistence & queueing | M2 | R4 |
| 5 | Report Field Capture | Capture Date/Time, Location, Description, Time Spent, Photos, Materials | M3 | R1 |
| 6 | Canvas Photo Compression | Downscale camera uploads to max 1280px JPEG Blobs stored in IndexedDB | M3 | R1, R3 |
| 7 | Non-Technical Mobile CRUD UI | Dashboard feed, Report Creator, Report Detail/Editor, Delete Confirmation with ≥48px targets | M3 | R2, R5 |
| 8 | Cloud Sync Engine & Offline Queue | Queue offline mutations, auto-sync on reconnect, status badges ("Pendente"/"Sincronizado") | M4 | R3 |
| 9 | Dual Cloud Provider | `CloudStorageProvider` interface with `MockCloudProvider` (for testing/dev) and Firebase stub | M4 | R3 |
| 10| E2E Opaque-Box Test Suite | Playwright & Vitest test suite covering Tiers 1-4, publication of `TEST_READY.md` | M5 (Track A)| Acceptance Criteria |

---

## Code Layout

```
c:\dev\estadio\maintenance_app\
├── index.html
├── package.json
├── vite.config.js
├── manifest.webmanifest
├── public/
│   ├── favicon.ico
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.js                     # PWA init & main app controller
│   ├── styles/
│   │   ├── main.css                # Base reset & font definitions
│   │   ├── theme.css               # Navy/Gold color variables & card styles
│   │   └── components.css          # Modals, forms, badges, touch targets
│   ├── db/
│   │   ├── db.js                   # Dexie database instance & schema
│   │   ├── reportsRepo.js          # Reports CRUD & IndexedDB queries
│   │   └── locationsRepo.js        # Locations CRUD & precaching
│   ├── services/
│   │   ├── connectivity.js         # Online/offline state listener
│   │   ├── photoService.js         # Canvas photo resizing & Blob conversion
│   │   ├── syncQueue.js            # Offline queue manager
│   │   ├── syncEngine.js           # Cloud sync execution engine
│   │   └── cloud/
│   │       ├── cloudInterface.js   # CloudStorageProvider interface
│   │       ├── mockCloudProvider.js# Standalone mock cloud engine
│   │       └── firebaseProvider.js # Firebase Firestore implementation
│   └── ui/
│       ├── header.js               # Navy top header & online/offline badge
│       ├── reportList.js           # Dashboard report feed & status badges
│       ├── reportForm.js           # Add/Edit report modal & photo preview
│       ├── reportDetailModal.js    # Report detail view & photo gallery
│       ├── locationModal.js        # Location selector & "Add Location" modal
│       └── toast.js                # Toasts & feedback notifications
├── sw.js                           # Custom Service Worker (App shell caching)
└── tests/
    ├── fixtures/                   # Sample test images & mock data
    ├── helpers/                    # Test helpers (fake-indexeddb, route intercepts)
    ├── unit/                       # Vitest unit tests
    └── e2e/                        # Playwright E2E tests (Tiers 1-4)
```

---

## Interface Contracts

### 1. Data Models (`src/db/db.js`)
```javascript
/**
 * @typedef {Object} PhotoItem
 * @property {string} id
 * @property {Blob|string} blobData - Canvas compressed JPEG Blob or dataURL
 * @property {string} type - 'before' | 'after' | 'work'
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Report
 * @property {string} id - UUID v4
 * @property {string} date - ISO 8601 string (e.g. "2026-08-11T14:30:00Z")
 * @property {string} locationId - ID of associated stadium location
 * @property {string} locationName - Cached location display name
 * @property {string} description - Work performed details
 * @property {number} timeSpentMinutes - Duration in minutes
 * @property {PhotoItem[]} photos - Array of compressed photos
 * @property {string} [materials] - Optional tools and materials used
 * @property {string} createdAt - ISO 8601 string
 * @property {string} updatedAt - ISO 8601 string
 * @property {number} synced - 0 for false, 1 for true
 * @property {number} deleted - 0 for active, 1 for soft deleted
 */

/**
 * @typedef {Object} Location
 * @property {string} id - UUID v4 or predefined code (e.g. "LOC_PITCH")
 * @property {string} name - Location display name (e.g. "Relvado Principal")
 * @property {string} [description] - Optional details
 * @property {boolean} isCustom - True if added dynamically by user offline
 * @property {string} createdAt - ISO 8601 string
 * @property {number} synced - 0 for false, 1 for true
 */

/**
 * @typedef {Object} SyncQueueItem
 * @property {number} [id] - Auto-increment primary key
 * @property {'report'|'location'} entityType
 * @property {string} entityId
 * @property {'CREATE'|'UPDATE'|'DELETE'} action
 * @property {Object} payload
 * @property {number} timestamp - Epoch milliseconds
 * @property {number} retryCount
 * @property {string} [lastError]
 */
```

### 2. Repositories (`src/db/reportsRepo.js`, `locationsRepo.js`)
```javascript
export class ReportsRepository {
  async getAllActive() {} // returns Report[] sorted by date DESC, deleted = 0
  async getById(id) {}
  async create(reportData, photosArray) {} // creates report, returns Report
  async update(id, updates) {}
  async delete(id) {} // soft delete: deleted = 1, synced = 0
  async markSynced(id) {}
}

export class LocationsRepository {
  async getAll() {} // returns Location[]
  async create(locationData) {}
  async seedDefaults(defaultLocationsList) {}
  async markSynced(id) {}
}
```

### 3. Cloud Storage Provider Interface (`src/services/cloud/cloudInterface.js`)
```javascript
export class CloudStorageProvider {
  async fetchLocations() { throw new Error('Not implemented'); }
  async fetchReports(sinceTimestamp) { throw new Error('Not implemented'); }
  async pushReport(report) { throw new Error('Not implemented'); }
  async deleteReport(reportId) { throw new Error('Not implemented'); }
  async pushLocation(location) { throw new Error('Not implemented'); }
}
```

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | PWA Core Shell & Storage | Vite setup, Navy/Gold design system, Dexie.js DB, SW precaching | None | DONE (`646ce803-9557-4be0-9844-9940ca77b21e`) |
| M2 | Dynamic Locations Engine | Locations repo, default seed, selector UI, offline add location | M1 | IN_PROGRESS (`eb7d7cbf-d9f1-45c3-8fe4-a06d0396d332`) |
| M3 | Report Management & Photos | Report CRUD UI, Canvas photo compression, detail & delete modals | M1, M2 | PLANNED |
| M4 | Offline Sync Engine & Cloud | Sync queue, online listener, auto-sync engine, mock cloud provider | M1, M2, M3 | PLANNED |
| M5 | E2E Testing Suite (Track A) | Opaque-box Playwright & Vitest suite across Tiers 1-4, `TEST_READY.md` | M1 | DONE (`2a922e2c-4dc4-4c13-be0e-8c789a13b411`) |
| M6 | Final Integration & Hardening | Pass 100% E2E tests, Tier 5 Adversarial Coverage Hardening | M1-M5 | PLANNED |

---

## Verification & Acceptance Criteria

1. **Offline Functionality**: App loads offline, creates/edits reports with photos offline, adds new locations offline.
2. **Data Sync**: Automatically pushes local reports & locations to cloud database upon reconnecting; pre-caches remote locations on boot.
3. **UI/UX & Native Feel**: Navy/Gold theme, min 48px touch targets, sticky 56px CTA, smooth CSS transitions, dual status badges ("Sincronizado" / "Pendente").
4. **E2E Test Suite**: 100% pass threshold across Playwright mobile E2E test suite (Tiers 1-4).
