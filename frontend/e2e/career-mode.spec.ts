import { test, expect } from '@playwright/test';

/**
 * career-mode.spec.ts
 * Tests Career Mode flows: profile, add job, job tracker, job detail.
 * All backend API calls are mocked.
 */

const EMPTY_PROFILE = {
  id: null,
  name: '',
  target_roles: [],
  target_locations: [],
  education: {},
  work_authorization_notes: '',
  skills: {},
  projects: [],
  preferences: {},
  created_at: null,
  updated_at: null,
};

const SAVED_PROFILE = {
  ...EMPTY_PROFILE,
  id: 1,
  name: 'Test User',
  target_roles: ['Software Engineer Intern'],
  target_locations: ['Toronto', 'Remote Canada'],
  skills: { languages: ['Python', 'TypeScript'], backend: ['FastAPI'] },
};

const MOCK_JOB = {
  id: 42,
  company_name: 'Acme Corp',
  role_title: 'Backend Intern',
  location: 'Toronto',
  job_url: 'https://example.com/job',
  application_url: null,
  source: 'Manual',
  raw_job_description: null,
  parsed_job: null,
  fit_score: null,
  fit_summary: null,
  fit_breakdown: null,
  status: 'saved',
  priority: 'unknown',
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_JOB_WITH_JD = {
  ...MOCK_JOB,
  raw_job_description: 'We are looking for a backend intern with Python skills. FastAPI experience preferred.',
};

test.beforeEach(async ({ page }) => {
  let profileData = { ...EMPTY_PROFILE };

  await page.route('**/api/career/profile', async (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileData) });
    } else if (route.request().method() === 'PUT') {
      profileData = { ...SAVED_PROFILE };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileData) });
    } else {
      route.continue();
    }
  });

  await page.route('**/api/career/jobs', async (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_JOB]) });
    } else if (route.request().method() === 'POST') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOB) });
    } else {
      route.continue();
    }
  });

  await page.route('**/api/career/jobs/42', async (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOB) });
    } else if (route.request().method() === 'PUT') {
      const body = await route.request().postDataJSON();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_JOB, ...body })
      });
    } else if (route.request().method() === 'DELETE') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    } else {
      route.continue();
    }
  });

  await page.route('**/api/questions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  );
  await page.route('**/api/sessions', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else {
      route.continue();
    }
  });
});

test('Career Mode page loads with no profile message', async ({ page }) => {
  await page.goto('/career');
  await expect(page.locator('h1.wordmark')).toContainText('Career Mode');
  // With empty profile, we should see a noProfileYet message or prompt to set up
  const panel = page.locator('.career-panel').first();
  await expect(panel).toBeVisible();
});

test('navigate to Candidate Profile', async ({ page }) => {
  await page.goto('/career');
  await page.getByText('Edit Profile').first().click();
  await expect(page).toHaveURL(/\/career\/profile/);
  await expect(page.locator('h1.wordmark')).toContainText('Candidate Profile');
});

test('back link on profile returns to Career Mode', async ({ page }) => {
  await page.goto('/career/profile');
  await page.locator('.back-link').click();
  await expect(page).toHaveURL('/career');
});

test('fill candidate profile and save', async ({ page }) => {
  await page.goto('/career/profile');
  await page.locator('#target-roles').fill('Software Engineer Intern, Backend Intern');
  await page.locator('#target-locations').fill('Toronto, Remote Canada');
  await page.getByText('Save Profile').click();
  // Should show saved feedback
  await expect(page.locator('.form-success')).toBeVisible();
  await expect(page.locator('.form-success')).toContainText('saved');
});

test('Add Job page loads and has back link', async ({ page }) => {
  await page.goto('/career/jobs/new');
  await expect(page.locator('h1.wordmark')).toContainText('Add Job');
  await expect(page.locator('.back-link')).toBeVisible();
});

test('URL-only job can be saved without JD', async ({ page }) => {
  await page.goto('/career/jobs/new');
  await page.locator('#job-company').fill('Acme Corp');
  await page.locator('#job-url').fill('https://example.com/job');
  // JD is empty — noJdWarning should show
  await expect(page.locator('.info-banner')).toBeVisible();
  await page.getByText('Save Job').click();
  // Should navigate to job detail
  await expect(page).toHaveURL(/\/career\/jobs\/42/);
});

test('Job Tracker lists jobs', async ({ page }) => {
  await page.goto('/career/jobs');
  await expect(page.locator('.career-table')).toBeVisible();
  await expect(page.getByText('Acme Corp')).toBeVisible();
});

test('back link on Job Tracker returns to Career Mode', async ({ page }) => {
  await page.goto('/career/jobs');
  await page.locator('.back-link').click();
  await expect(page).toHaveURL('/career');
});

test('Job Detail loads with back link', async ({ page }) => {
  await page.goto('/career/jobs/42');
  await expect(page.locator('.back-link')).toBeVisible();
  await expect(page.locator('h1.wordmark')).toContainText('Acme Corp');
});

test('status edit is interactive on job detail', async ({ page }) => {
  await page.goto('/career/jobs/42');
  // Find the status edit button
  const statusBtn = page.locator('.profile-grid').getByRole('button').first();
  await statusBtn.click();
  // A select should appear
  const select = page.locator('.profile-grid select');
  await expect(select).toBeVisible();
});

test('delete job shows confirmation then navigates away', async ({ page }) => {
  await page.goto('/career/jobs/42');
  await page.getByText('Delete Job').first().click();
  await expect(page.locator('.confirm-dialog')).toBeVisible();
  await page.locator('.btn-danger').click();
  await expect(page).toHaveURL('/career/jobs');
});

test('noJdWarning shows on job detail without JD', async ({ page }) => {
  await page.goto('/career/jobs/42');
  await expect(page.locator('.info-banner')).toBeVisible();
});
