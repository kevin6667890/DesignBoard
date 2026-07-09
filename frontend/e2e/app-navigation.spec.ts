import { test, expect } from '@playwright/test';

/**
 * app-navigation.spec.ts
 * Tests: home loads, nav items visible, routing, language toggle
 * API calls are intercepted to avoid needing a live backend.
 */

const MOCK_QUESTIONS = [
  { id: 'q1', title: 'Design a URL Shortener', title_zh: '设计短链接系统', difficulty: 'Easy', description: 'Design a scalable URL shortener.' },
  { id: 'q2', title: 'Design Twitter', title_zh: '设计 Twitter', difficulty: 'Hard', description: 'Design a scalable social network.' },
];

const MOCK_SESSIONS: unknown[] = [];

test.beforeEach(async ({ page }) => {
  // Intercept backend API calls
  await page.route('**/api/questions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_QUESTIONS) })
  );
  await page.route('**/api/sessions', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSIONS) });
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
  await page.route('**/api/career/jobs', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else {
      route.continue();
    }
  });
});

test('home page loads and shows app title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DesignBoard/i);
  await expect(page.locator('h1.wordmark')).toBeVisible();
  await expect(page.locator('h1.wordmark')).toContainText('DesignBoard');
});

test('nav items are visible on home', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav.main-nav');
  await expect(nav).toBeVisible();
  await expect(nav.getByText('Practice')).toBeVisible();
  await expect(nav.getByText('Custom JD Interview')).toBeVisible();
  await expect(nav.getByText('Career Mode')).toBeVisible();
  await expect(nav.getByText('History')).toBeVisible();
});

test('navigate to JD Interview page', async ({ page }) => {
  await page.goto('/');
  await page.locator('nav.main-nav').getByText('Custom JD Interview').click();
  await expect(page).toHaveURL(/\/custom/);
  await expect(page.locator('h1.wordmark')).toBeVisible();
});

test('navigate to Career Mode page', async ({ page }) => {
  await page.goto('/');
  await page.locator('nav.main-nav').getByText('Career Mode').click();
  await expect(page).toHaveURL(/\/career/);
});

test('navigate to History page', async ({ page }) => {
  await page.goto('/');
  await page.locator('nav.main-nav').getByText('History').click();
  await expect(page).toHaveURL(/\/history/);
});

test('navigate back to Practice from other pages', async ({ page }) => {
  await page.goto('/history');
  await page.locator('nav.main-nav').getByText('Practice').click();
  await expect(page).toHaveURL('/');
});

test('language toggle switches UI to Chinese', async ({ page }) => {
  await page.goto('/');
  // Find UI language segmented control - the second button in language controls is 中文
  const langControls = page.locator('.language-controls');
  await expect(langControls).toBeVisible();
  // Switch UI language to Chinese
  const zhBtn = langControls.locator('button').filter({ hasText: '中文' }).first();
  await zhBtn.click();
  // After switching, Chinese labels should appear in nav
  await expect(page.locator('nav.main-nav').getByText('练习')).toBeVisible();
  await expect(page.locator('nav.main-nav').getByText('JD 定制面试')).toBeVisible();
  await expect(page.locator('nav.main-nav').getByText('求职模式')).toBeVisible();
  await expect(page.locator('nav.main-nav').getByText('历史记录')).toBeVisible();
});

test('switch back to English after Chinese', async ({ page }) => {
  await page.goto('/');
  const langControls = page.locator('.language-controls');
  const zhBtn = langControls.locator('button').filter({ hasText: '中文' }).first();
  await zhBtn.click();
  // Now switch back
  const enBtn = langControls.locator('button').filter({ hasText: 'English' }).first();
  await enBtn.click();
  await expect(page.locator('nav.main-nav').getByText('Practice')).toBeVisible();
});

test('questions from API are displayed on home', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.question-grid')).toBeVisible();
  await expect(page.getByText('Design a URL Shortener')).toBeVisible();
});

test('active nav item is highlighted', async ({ page }) => {
  await page.goto('/history');
  const historyBtn = page.locator('nav.main-nav button').filter({ hasText: 'History' });
  await expect(historyBtn).toHaveClass(/nav-active/);
});
