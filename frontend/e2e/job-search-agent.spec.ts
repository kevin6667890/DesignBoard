import { test, expect } from '@playwright/test';

const planResponse = {
  search_summary: 'Public-search plan for Backend Developer Intern around Canada.',
  recommended_queries: [
    { source: 'Google', query: '"Backend Developer Intern" "Canada" "Summer 2027"', url: 'https://www.google.com/search?q=Backend+Developer+Intern', why: 'Broad search' },
    { source: 'Greenhouse', query: 'site:greenhouse.io "Backend Developer Intern" "Canada"', url: 'https://www.google.com/search?q=site:greenhouse.io', why: 'Public Greenhouse postings' },
  ],
  source_strategy: [{ source: 'Company Careers', instructions: 'Check public careers pages.' }],
  manual_steps: ['Open links manually.', 'Paste visible result text.'],
};

const leadsResponse = {
  job_leads: [
    {
      company_name: 'Acme Corp',
      role_title: 'Backend Developer Intern',
      location: 'Toronto',
      source: 'Google',
      job_url: 'https://example.com/jobs/backend-intern',
      application_url: null,
      snippet: 'Acme Corp is hiring a Backend Developer Intern in Toronto for Summer 2027.',
      confidence: 88,
      needs_jd: true,
      reason: 'Clear internship posting snippet.',
      duplicate_key: 'acme|backend|toronto',
      duplicate_warning: null,
    },
  ],
  ignored_items: [],
};

const savedResponse = {
  saved_jobs: [{ id: 99, company_name: 'Acme Corp', role_title: 'Backend Developer Intern' }],
  duplicates: [],
  skipped: [],
};

async function mockSearchAgentApis(page) {
  await page.route('**/api/career/profile', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: null, target_roles: [], target_locations: [], skills: {}, education: {}, projects: [], preferences: {} }) }));
  await page.route('**/api/career/jobs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/career/search/plan', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(planResponse) }));
  await page.route('**/api/career/search/extract', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadsResponse) }));
  await page.route('**/api/career/search/fetch-public', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ url: 'https://example.com/careers', text: 'Backend Intern posting', error: null }], job_leads: leadsResponse.job_leads }) }));
  await page.route('**/api/career/search/save-leads', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(savedResponse) }));
}

test.beforeEach(async ({ page }) => {
  await mockSearchAgentApis(page);
});

test('page loads from Career Mode', async ({ page }) => {
  await page.goto('/career');
  await page.getByText('Job Search Agent').click();
  await expect(page).toHaveURL('/career/search-agent');
  await expect(page.locator('h1.wordmark')).toContainText('Job Search Agent');
});

test('generate search plan with mocked response', async ({ page }) => {
  await page.goto('/career/search-agent');
  await page.getByLabel('Target role').fill('Synthetic Backend Intern');
  await page.getByText('Generate search plan').click();
  await expect(page.getByText('Public-search plan')).toBeVisible();
  await expect(page.getByText('site:greenhouse.io')).toBeVisible();
});

test('copy query button works', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/career/search-agent');
  await page.getByLabel('Target role').fill('Synthetic Backend Intern');
  await page.getByText('Generate search plan').click();
  await page.getByRole('button', { name: 'Copy query' }).first().click();
  await expect(page.getByRole('button', { name: 'Copied!' }).first()).toBeVisible();
});

test('paste result text and extract leads with mocked response', async ({ page }) => {
  await page.goto('/career/search-agent');
  await page.getByLabel('Paste search result text, job alert text, or public page text').fill('Acme Corp Backend Developer Intern Toronto');
  await page.getByText('Extract Job Leads').click();
  await expect(page.getByText('Acme Corp', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backend Developer Intern' })).toBeVisible();
});

test('review extracted leads and save selected', async ({ page }) => {
  await page.goto('/career/search-agent');
  await page.getByLabel('Paste search result text, job alert text, or public page text').fill('Acme Corp Backend Developer Intern Toronto');
  await page.getByText('Extract Job Leads').click();
  await expect(page.locator('.lead-card')).toHaveCount(1);
  await page.getByText('Save selected').click();
  await expect(page.getByText('Saved leads')).toBeVisible();
});

test('Chinese UI labels appear when language is Chinese', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('designboard_ui_language', 'zh'));
  await page.goto('/career/search-agent');
  await expect(page.getByText('搜索助手').first()).toBeVisible();
  await expect(page.getByText('生成搜索计划')).toBeVisible();
});

test('empty and error states render', async ({ page }) => {
  await page.route('**/api/career/search/plan', (route) => route.fulfill({ status: 500, body: 'boom' }));
  await page.goto('/career/search-agent');
  await expect(page.getByText('No generated queries yet.')).toBeVisible();
  await expect(page.getByText('No leads found.')).toBeVisible();
  await page.getByLabel('Target role').fill('Synthetic Backend Intern');
  await page.getByText('Generate search plan').click();
  await expect(page.locator('.error-state')).toBeVisible();
});
