import { test, expect } from '@playwright/test';

/**
 * jd-planner.spec.ts
 * Tests JD Planner flow: open, paste JD, mock blueprint generation.
 * DeepSeek API is mocked via route interception.
 */

const MOCK_JD = `
Software Engineering Intern - Backend (Summer 2027)
Company: TechCorp Inc.
Location: Toronto, ON (Hybrid)

We are looking for a backend intern with strong Python skills to join our infrastructure team.

Responsibilities:
- Build and maintain REST APIs using FastAPI
- Work with PostgreSQL databases
- Contribute to our CI/CD pipeline

Requirements:
- 2nd or 3rd year CS student
- Proficiency in Python
- Experience with REST APIs
- Familiarity with SQL databases

Nice to have:
- Experience with Docker
- Kubernetes basics
- AWS knowledge

Work authorization: Must be eligible to work in Canada.
`;

const MOCK_PROFILE = {
  id: 1,
  company_name: 'TechCorp Inc.',
  role_title: 'Software Engineering Intern',
  seniority: 'intern',
  domain: 'backend',
  tech_stack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
  responsibilities: ['Build REST APIs', 'Work with databases'],
  required_skills: ['Python', 'REST APIs', 'SQL'],
  interview_focus: ['system design', 'backend'],
  language: 'en',
};

const MOCK_BLUEPRINT = {
  id: 1,
  profile_id: 1,
  summary: 'Focus on backend system design with Python and distributed systems.',
  coding_focus: ['Python OOP', 'Algorithm efficiency'],
  cs_fundamentals_focus: ['OS fundamentals', 'Networking basics'],
  system_design_focus: ['API design', 'Database scaling'],
  domain_deep_dive_focus: ['REST vs GraphQL', 'Database indexing'],
  behavioral_focus: ['teamwork', 'ownership'],
  scoring_focus: ['requirements clarity', 'scalability'],
  custom_system_design_questions: [
    {
      title: 'Design a Rate Limiter',
      difficulty: 'medium',
      why_relevant: 'Common backend challenge for API services',
      expected_topics: ['token bucket', 'Redis', 'distributed locks'],
    },
    {
      title: 'Design a Job Queue',
      difficulty: 'hard',
      why_relevant: 'Relevant for async task processing at TechCorp',
      expected_topics: ['message queues', 'idempotency', 'retry logic'],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/jd/analyze', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: MOCK_PROFILE, blueprint: MOCK_BLUEPRINT }),
    })
  );
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
  await page.route('**/api/career/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: null, name: '', target_roles: [], target_locations: [], education: {}, work_authorization_notes: '', skills: {}, projects: [], preferences: {}, created_at: null, updated_at: null })
    })
  );
  await page.route('**/api/career/jobs', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  );
});

test('JD Planner page loads', async ({ page }) => {
  await page.goto('/custom');
  await expect(page.locator('h1.wordmark')).toContainText('DesignBoard');
  await expect(page.locator('#jd-textarea')).toBeVisible();
});

test('back link on JD Planner goes to home', async ({ page }) => {
  await page.goto('/custom');
  await expect(page.locator('.back-link')).toBeVisible();
  await page.locator('.back-link').click();
  await expect(page).toHaveURL('/');
});

test('generate button is disabled with empty JD', async ({ page }) => {
  await page.goto('/custom');
  const generateBtn = page.getByText('Generate Interview Plan');
  await expect(generateBtn).toBeDisabled();
});

test('paste JD and generate blueprint', async ({ page }) => {
  await page.goto('/custom');
  await page.locator('#jd-textarea').fill(MOCK_JD);
  const generateBtn = page.getByText('Generate Interview Plan');
  await expect(generateBtn).not.toBeDisabled();
  await generateBtn.click();
  // Should show blueprint sections
  await expect(page.locator('.blueprint-panel')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.question-recommendations')).toBeVisible();
  await expect(page.getByText('Design a Rate Limiter')).toBeVisible();
  await expect(page.getByText('Design a Job Queue')).toBeVisible();
});

test('company and role optional fields are present', async ({ page }) => {
  await page.goto('/custom');
  await expect(page.locator('#company-input')).toBeVisible();
  await expect(page.locator('#role-input')).toBeVisible();
});

test('start interview buttons appear on blueprint questions', async ({ page }) => {
  await page.goto('/custom');
  await page.locator('#jd-textarea').fill(MOCK_JD);
  await page.getByText('Generate Interview Plan').click();
  await expect(page.locator('.question-recommendations')).toBeVisible({ timeout: 10000 });
  const startBtns = page.locator('.custom-question-card .btn-filled');
  await expect(startBtns.first()).toBeVisible();
  await expect(startBtns.first()).toContainText('Start Interview');
});

test('interview language toggle exists', async ({ page }) => {
  await page.goto('/custom');
  const langToggle = page.locator('.segmented-control.inline');
  await expect(langToggle).toBeVisible();
  await expect(langToggle.getByText('English')).toBeVisible();
  await expect(langToggle.getByText('中文')).toBeVisible();
});
