# Limble CMMS mobile app — visual reference

39 real images downloaded 2026-08-14. Every file listed below exists on disk in this folder.

Two generations of the app are represented, and they look **completely different**. Do not mix them.

- `legacy-*` / `qr-*` — the **old** Limble CMMS app (App Store id `1108935725`, Play `io.gonative.android.rkknl`, now labelled "Limble CMMS (Legacy)"). Webview-ish, multi-coloured gear logo, forest-green accents, hamburger drawer.
- `new-*` / `new-tablet-*` / `web-01` — the **new technician-first app** launched March 2026 (App Store id `6755496529`, Play `com.limblecmms.mobileApp`). Navy + acid-lime brand, 4-tab bottom bar, card-based lists.
- `real-*` — un-styled crops straight out of the help centre, i.e. **actual product pixels with no marketing polish**. The most trustworthy files here for judging real spacing/colour.

---

## New app (Mar 2026, technician-first) — phone

| File | Source | Screen |
|---|---|---|
| `new-01-home-quick-actions-suggested-tasks.png` | apps.apple.com/us/app/limble/id6755496529 | Home: logo bar, green quick-action chip row (Scan QR / Create WO / Assets…), "Suggested tasks" 2×2 counter grid, Bookmarked tasks card, My stats, 4-tab bottom bar. |
| `new-02-asset-lookup-search.png` | same | "Look up an asset" — search field over a list of asset cards, each with `#id`, name, blue `Open`, "N child assets ›". |
| `new-03-work-request-instructions-steps-timer.png` | same | Work request #271 → Instructions tab: numbered step cards with green check bubbles, dropdown + numeric answer fields, running timer with pause/stop at the bottom. |
| `new-04-create-work-order-from-qr-scan.png` | same | "Create work order" form (Task name / Priority / Task type / Due date / Start date), shown reached by scanning an asset QR code. |
| `new-05-task-activity-timeline-comment.png` | same | Task activity timeline: task card → status-change card → user comment card, joined by a lime vertical connector; lime "Completed" pill. |
| `new-06-tasks-calendar-and-list.png` | same | Tasks tab: search, horizontal week strip (green pill on selected day, dots on days with work), then "Tasks 4/29 · 2 due" list of work-order cards. |

## New app — tablet layouts

| File | Source | Screen |
|---|---|---|
| `new-tablet-01-asset-lookup-breadcrumb.png` | play.google.com/store/apps/details?id=com.limblecmms.mobileApp | Asset lookup on tablet, with a location breadcrumb strip (Brooklyn / Level 2 / Room 34 / Conveyor). |
| `new-tablet-02-home-full-quick-action-row.png` | same | Tablet Home showing the **full** quick-action row: Scan QR, Create WO, Assets, Parts, Support. Best evidence of the complete action set. |
| `new-tablet-03-task-activity-timeline.png` | same | Task activity timeline, tablet width. |
| `new-tablet-04-tasks-calendar-and-list.png` | same | Tasks calendar + list, tablet width (mixes "Unplanned WO" and "Work request" row types). |
| `new-tablet-05-work-request-instructions.png` | same | Work request #123 Instructions, tablet; also shows a "Create WO" spawn-child-work-order block. |
| `new-tablet-06-create-work-order.png` | same | Create work order form, tablet width. |
| `web-01-mobile-app-page-header.png` | limble.com/products/mobile-app (`…69a73c03…_Mobile Header`) | Marketing header: new Home screen next to an enlarged Task #1204 detail card with Open / In Progress / Completed status buttons. |

## Real un-styled product crops (help centre)

| File | Source | Screen |
|---|---|---|
| `real-01-task-detail-tabs-details-instructions-comments.png` | help.limblecmms.com/en/articles/11698403-using-the-new-limble-mobile-app | Task #36 header: back-to-Home chevron, centred title, ⋯ menu, and the Details / Instructions / Comments tab bar (green underline on active, red dot badge on Instructions). |
| `real-02-task-timer-and-start-instructions.png` | same | Bottom-of-task timer `00:00 03` with circular pause/stop buttons and a "Start instructions" row. |
| `real-03-assets-search-with-qr-icon-location-list.png` | same | "Search assets" field with a QR-scan glyph inside it, above a location list (pin icon + chevron rows). |
| `real-04-asset-row-child-assets-breadcrumb.png` | same | Asset row anatomy: breadcrumb bar, cube icon + `#32`, bold name, blue `Open`, "2 child assets ›". |
| `real-05-asset-row-open-link.png` | same | Asset row with no children — cube `#37`, name, blue `Open`. |
| `real-06-asset-breadcrumb-child-asset-list.png` | same | Drilled-in breadcrumb (gear / Coffee Factory / **Building 1**) over child asset rows. |

## QR / barcode entry point

| File | Source | Screen |
|---|---|---|
| `qr-01-scanner-camera-viewfinder.png` | help.limblecmms.com/en/articles/3152487-the-mobile-app-qr-code-scanner | Full-screen black scanner: "Close" left, "Scan" centred, flash toggle top-right, white rounded viewfinder rectangle, grey hint bar "Place the QR code or barcode within the viewfinder to scan". |
| `qr-02-barcode-scan-and-asset-result.png` | help.limblecmms.com/en/articles/9653334-adding-barcodes-to-limble | Side-by-side: barcode being scanned, and the resulting asset card with the Barcode field filled in. |

## Legacy app

| File | Source | Screen |
|---|---|---|
| `legacy-01-hero-home-menu-and-open-tasks.png` | apps.apple.com/us/app/limble-cmms/id1108935725 | Marketing hero: legacy Home tile menu (Essentials / Work Orders / Search groups) + green-header "Open Tasks" list. |
| `legacy-02-task-list-open-tasks.png` | same | Open Tasks list: priority chip + status pill, wrench icon + bold title, asset breadcrumb, then `#id / assignee / due date / instruction count`. Bottom nav Dashboards / Tasks / Home / Start WO / Search. |
| `legacy-03-start-work-request-form.png` | same | "Start A Work Request" — Title / Where or what is having a problem? / How can we help? + annotated attached photo. |
| `legacy-04-pm-edit-schedule.png` | same | "Edit Schedule": Daily/Weekly radios, "Repeat every [−1+] weeks", Add Time, weekday dropdown, Start on. |
| `legacy-05-view-asset-detail.png` | same | "View Asset": green make/model card with photo, row of 8 icon tabs, then Name / location / Status fields. |
| `legacy-06-part-qty-thresholds.png` | same | Part settings: Minimum / Maximum / Stale quantity thresholds + full-width green **Save**. |
| `legacy-07-custom-dashboards-widgets-wide.png` | play.google.com/store/apps/details?id=io.gonative.android.rkknl | Custom Dashboards: MTTR green stat tile, "This Week's Tasks" donut, Planned vs Unplanned line chart. |
| `legacy-08-task-complete-signature-wide.png` | same | Task #326 completed: Instructions "Completed: 100%" green progress bar, red signature capture, Assigned To / Time to Complete. |
| `legacy-09-task-complete-signature-phone.png` | same | Same completion flow in a phone frame, plus the status-change activity log. |
| `legacy-10-manage-work-grouped-by-technician.png` | same | "Manage Work": tasks grouped under technician avatars (Rachel Link / Jeff Smith / Nolan Eades) with priority + status letter badges. |
| `legacy-11-start-work-request-wide.png` | same | Work request form, wide two-column variant ("Damaged Belt" / Production Facility). |
| `legacy-12-view-asset-detail-wide.png` | same | View Asset, wide variant (Name and Status side by side). |
| `legacy-13-pm-edit-schedule-wide.png` | same | Edit Schedule, wide variant — weekday checkboxes inline, and the full recurrence list (Monthly / Yearly / Number of units / Threshold). |
| `legacy-14-desktop-dashboard-on-laptop.png` | same | The desktop web dashboard on a laptop — useful only as the visual parent of the mobile design. |
| `legacy-15-dashboard-metric-widgets-phone.png` | same | Phone dashboard: "+ Add Widget" then stacked coloured metric tiles (green Planned vs Unplanned, blue Total Operating Costs, orange MTTR). |
| `legacy-16-part-settings-condensor-coil-wide.png` | same | "Condensor Coil - Settings" part card with a purple part-image panel and the threshold fields. |
| `legacy-17-part-detail-air-filter.png` | help.limblecmms.com/en/articles/3152487-the-mobile-app-qr-code-scanner | **Real** legacy part detail ("Air filter - Copy"): purple header card with part image, icon tab row, Part Name / Part Number / # Qty / Add a Purchase Order. |
| `legacy-18-nav-drawer-full-menu.png` | same | **Real** legacy hamburger drawer, the whole legacy IA in one shot: Home (green active), Dashboards, Open Tasks, Start A Work Order, Submit a Work Request, Global Search, Search Asset, Search Part, Search Vendor, Search PO, Receive PO Items, Scan QR Code, Maps. |

---

## Observable design facts

Only things visible in the images above.

### New app (2026)

- **Palette.** Near-black navy background on marketing frames (~`#0A0F2C`); acid/lime green (~`#C8F135`) as the loud brand accent, used for solid blocks, the "Completed" pill and timeline connectors. In-app chrome is white/very light grey (~`#F7F8F9`). Primary buttons are a **darker forest green** (~`#1B7A3E`), not the lime — lime is brand, green is action.
- **Semantic colour.** Status/priority is carried by *text colour*, not filled badges: `Critical` red, `Medium priority` orange, `Low priority` green, `Open`/links blue (~`#1A73E8`). Notification counts are red circles.
- **List rows.** Loose, card-per-row, roughly 4 rows visible per screen. Each card is ~4 stacked lines: type + `#id` (small grey) → **bold dark title** (largest text in the row) → asset line with a grey cube glyph → footer line with priority left / status right. Avatar stack (`+8`) sits top-right of the card. Generous ~16px internal padding, white cards on light grey, subtle rounding, no heavy dividers.
- **Primary actions.** *Top*, not bottom: a horizontally scrolling row of solid green pill buttons directly under the header (Scan QR, Create WO, Assets, Parts, Support). No floating action button anywhere. Task-level actions (pause/stop timer) sit in a pinned bottom bar of the detail screen.
- **Navigation.** 4-item bottom tab bar — Home / Tasks / Assets / More — line icons, label under icon, green tint on the active item. Detail screens use back-chevron + centred title + ⋯ overflow, with a segmented tab bar (green underline) below.
- **Icons.** Thin monoline outline set, ~1.5px stroke, geometric. The asset concept is consistently a wireframe cube; assets/parts are never photos in list rows.
- **Typography.** One geometric sans throughout. Strong weight contrast rather than size contrast: bold/semibold titles at roughly 17–18px against 13–14px regular grey metadata. Numbers in the counter grid are very large and bold (~28px+) over a small grey label. All-sentence case, no uppercase labels.

### Legacy app (still visible in most search results)

- **Palette.** Forest green (~`#1E8449`) primary — solid green Save buttons, green screen headers, green active nav; a much darker navy for text/icons; purple and blue used decoratively on part/metric cards. Multi-coloured (red/green/orange/yellow) gear logo.
- **List rows.** Tight and information-dense — 5–6 rows per screen, separated by hairline rules rather than cards. Each row crams a coloured priority chip, an outlined status pill, a wrench icon + bold title, an asset breadcrumb with `>` separators, and a metadata strip of tiny icon+value pairs (`#id`, person, calendar, instruction count).
- **Primary actions.** Full-width solid green button pinned at the bottom of forms (`Save`), plus a 5-item bottom bar: Dashboards / Tasks / **Home** (logo, centre) / Start WO / Search. Deep navigation lives in a left hamburger drawer.
- **Icons.** Filled/solid glyphs, chunkier and darker than the new app. Asset detail uses a row of 8 undifferentiated icon tabs — dense, low-affordance.
- **Typography.** Same geometric sans family but tighter leading; field labels are small blue-grey above boxed inputs; every form field is a visible bordered rectangle, giving a distinctly web-form feel versus the new app's cards.

### Cross-cutting patterns worth copying

- Location/asset **breadcrumbs** appear on nearly every list and detail screen — hierarchy (site → building → asset → child asset) is a first-class navigation idea in both generations.
- Work is always identified by a **type + `#number`** pair (`Unplanned WO #125`, `Work request #1204`, `Task #36`), shown above the human-readable title.
- QR/barcode scanning is a top-level entry point in both generations (drawer item in legacy, first quick-action chip and an in-search-field glyph in the new app), and the scanner itself is a plain black full-screen viewfinder with a hint bar.
- Instruction execution is a **checklist of numbered steps** with mixed input types (checkbox, dropdown, numeric, signature) plus a task timer and a percent-complete bar.

## Surfaces not obtained

- A **parts / inventory list** screen (only part *detail* and part *threshold-settings* screens were found: `legacy-17`, `legacy-06`, `legacy-16`). Per Limble's docs the list lives at More → Parts in the new app; no screenshot of it is published.
- Any **new-app** parts, dashboard/reporting, or offline-mode screen — the 2026 app's published screenshots cover only Home, Tasks, Assets, work-request detail and Create WO.
- A dedicated **new-app QR scanner** screenshot; `qr-01` is the legacy scanner (visually a plain black camera view, likely little changed).
- No G2 / Capterra / GetApp gallery images — those hosts returned HTTP 403. No YouTube thumbnails or transcripts were saved.
