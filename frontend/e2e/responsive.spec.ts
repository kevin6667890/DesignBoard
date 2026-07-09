import { test, expect } from '@playwright/test';

/**
 * responsive.spec.ts
 * Tests key pages at desktop and smaller viewport sizes.
 */

const MOCK_SETUP = async ({ page }: { page: import('@playwright/test').Page }) => {
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
};

test.describe('Desktop viewport (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => { await MOCK_SETUP({ page }); });

  test('home page renders correctly at 1280px', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('nav.main-nav')).toBeVisible();
    await expect(page.locator('.language-controls')).toBeVisible();
  });

  test('all main nav items visible on desktop', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav.main-nav');
    await expect(nav.getByText('Practice')).toBeVisible();
    await expect(nav.getByText('Custom JD Interview')).toBeVisible();
    await expect(nav.getByText('Career Mode')).toBeVisible();
    await expect(nav.getByText('History')).toBeVisible();
  });

  test('JD planner textarea is visible on desktop', async ({ page }) => {
    await page.goto('/custom');
    await expect(page.locator('#jd-textarea')).toBeVisible();
  });

  test('career mode page renders on desktop', async ({ page }) => {
    await page.goto('/career');
    await expect(page.locator('.career-page')).toBeVisible();
    await expect(page.locator('.career-actions')).toBeVisible();
  });
});

test.describe('Smaller viewport (768x1024 - tablet)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test.beforeEach(async ({ page }) => { await MOCK_SETUP({ page }); });

  test('home page is usable at 768px', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home')).toBeVisible();
    await expect(page.locator('nav.main-nav')).toBeVisible();
  });

  test('nav items still visible at 768px', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav.main-nav').getByText('Practice')).toBeVisible();
  });

  test('career page is usable at 768px', async ({ page }) => {
    await page.goto('/career');
    await expect(page.locator('.career-page')).toBeVisible();
  });
});

test.describe('Small viewport (390x844 - mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => { await MOCK_SETUP({ page }); });

  test('home page renders at 390px without horizontal scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home')).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 390;
    // Allow a small tolerance
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test('language controls are visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.language-controls')).toBeVisible();
  });
});

test.describe('Interview room at different viewports', () => {
  const MOCK_SESSION = {
    id: 99,
    question_id: 'q1',
    question_title: 'Design a URL Shortener',
    difficulty: 'Easy',
    interview_language: 'en',
    session_type: 'built_in',
    profile_id: null,
    blueprint_id: null,
    custom_question_title: null,
    custom_question_context: null,
    profile: null,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_seconds: null,
    status: 'active',
    score_requirements: null,
    score_components: null,
    score_scalability: null,
    score_data_modeling: null,
    score_communication: null,
    score_total: null,
    missed_points: null,
    summary: null,
    role_fit_summary: null,
  };

  const MOCK_MESSAGES = [
    { id: 1, session_id: 99, role: 'interviewer', content: 'Tell me the requirements.', created_at: new Date().toISOString(), input_mode: null, transcript_confidence: null }
  ];

  const setupSession = async ({ page }: { page: import('@playwright/test').Page }) => {
    await page.route('**/api/sessions/99', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session: MOCK_SESSION, messages: MOCK_MESSAGES }),
      })
    );
    await page.route('**/api/sessions/99/messages', (route) =>
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"done": true}\n\n' })
    );
    await page.route('**/api/sessions/99/end', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_SESSION, status: 'completed', score_total: 30 }) })
    );
  };

  test('interview room usable at 900px width', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await setupSession({ page });
    await page.goto('/interview/99');
    await expect(page.locator('.interview-room')).toBeVisible();
    await expect(page.locator('.alex-panel')).toBeVisible();
    await expect(page.locator('.message-input')).toBeVisible();
  });

  test('interview room usable at 620px width', async ({ page }) => {
    await page.setViewportSize({ width: 620, height: 900 });
    await setupSession({ page });
    await page.goto('/interview/99');
    await expect(page.locator('.interview-room')).toBeVisible();
    await expect(page.locator('.message-input')).toBeVisible();
  });
});
