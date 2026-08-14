import { Page, Route } from '@playwright/test';

export interface RemoteLocation {
  id: string;
  name: string;
  description?: string;
  isCustom: boolean;
  createdAt: string;
  synced: number;
}

export interface RemoteReport {
  id: string;
  date: string;
  locationId: string;
  locationName: string;
  description: string;
  timeSpentMinutes: number;
  photos: any[];
  materials?: string;
  createdAt: string;
  updatedAt: string;
  synced: number;
  deleted: number;
}

export class MockSyncServer {
  private locations: RemoteLocation[] = [
    { id: 'LOC_PITCH', name: 'Relvado Principal', isCustom: false, createdAt: new Date().toISOString(), synced: 1 },
    { id: 'LOC_CHANGING', name: 'Balneários', isCustom: false, createdAt: new Date().toISOString(), synced: 1 },
    { id: 'LOC_NORTH_STAND', name: 'Bancada Norte', isCustom: false, createdAt: new Date().toISOString(), synced: 1 },
  ];

  private reports: RemoteReport[] = [];

  /**
   * Set up Playwright route interception for cloud sync endpoints.
   */
  async setup(page: Page): Promise<void> {
    // Intercept /api/v1/locations (GET, POST)
    await page.route(/\/api\/v1\/locations(\?.*)?$/, async (route: Route) => {
      const request = route.request();
      const method = request.method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(this.locations),
        });
      } else if (method === 'POST') {
        const postData = JSON.parse(request.postData() || '{}');
        const newLocation: RemoteLocation = {
          ...postData,
          synced: 1,
          createdAt: postData.createdAt || new Date().toISOString(),
        };
        this.locations.push(newLocation);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newLocation),
        });
      } else {
        await route.continue();
      }
    });

    // Intercept /api/v1/reports/* (PUT, DELETE) - must come before /api/v1/reports matcher or be distinguished
    await page.route(/\/api\/v1\/reports\/([^\/]+)$/, async (route: Route) => {
      const request = route.request();
      const method = request.method();
      const url = request.url();
      const matches = url.match(/\/api\/v1\/reports\/([^\/]+)$/);
      const reportId = matches ? matches[1] : null;

      if (method === 'PUT' && reportId) {
        const updates = JSON.parse(request.postData() || '{}');
        const idx = this.reports.findIndex(r => r.id === reportId);
        if (idx !== -1) {
          this.reports[idx] = {
            ...this.reports[idx],
            ...updates,
            synced: 1,
            updatedAt: new Date().toISOString(),
          };
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(this.reports[idx]),
          });
        } else {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Report not found' }),
          });
        }
      } else if (method === 'DELETE' && reportId) {
        const idx = this.reports.findIndex(r => r.id === reportId);
        if (idx !== -1) {
          this.reports[idx].deleted = 1;
          this.reports[idx].synced = 1;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: reportId }),
        });
      } else {
        await route.continue();
      }
    });

    // Intercept /api/v1/reports (GET, POST)
    await page.route(/\/api\/v1\/reports(\?.*)?$/, async (route: Route) => {
      const request = route.request();
      const method = request.method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(this.reports),
        });
      } else if (method === 'POST') {
        const postData = JSON.parse(request.postData() || '{}');
        const newReport: RemoteReport = {
          ...postData,
          synced: 1,
          createdAt: postData.createdAt || new Date().toISOString(),
          updatedAt: postData.updatedAt || new Date().toISOString(),
        };
        this.reports.push(newReport);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newReport),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Returns array of reports stored in mock server state.
   */
  getRemoteReports(): RemoteReport[] {
    return [...this.reports];
  }

  /**
   * Returns array of locations stored in mock server state.
   */
  getRemoteLocations(): RemoteLocation[] {
    return [...this.locations];
  }

  /**
   * Seed locations into mock server state.
   */
  seedLocations(locations: RemoteLocation[]): void {
    this.locations = [...locations];
  }

  /**
   * Seed reports into mock server state.
   */
  seedReports(reports: RemoteReport[]): void {
    this.reports = [...reports];
  }

  /**
   * Reset mock server state to defaults.
   */
  reset(): void {
    this.locations = [
      { id: 'LOC_PITCH', name: 'Relvado Principal', isCustom: false, createdAt: new Date().toISOString(), synced: 1 },
      { id: 'LOC_CHANGING', name: 'Balneários', isCustom: false, createdAt: new Date().toISOString(), synced: 1 },
      { id: 'LOC_NORTH_STAND', name: 'Bancada Norte', isCustom: false, createdAt: new Date().toISOString(), synced: 1 },
    ];
    this.reports = [];
  }
}
