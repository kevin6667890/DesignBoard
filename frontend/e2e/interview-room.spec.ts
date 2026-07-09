import { test, expect } from '@playwright/test';

/**
 * interview-room.spec.ts
 * Tests the interview room UI without real mic/camera.
 * Backend streaming is mocked via route interception.
 */

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
  {
    id: 1,
    session_id: 99,
    role: 'interviewer',
    content: "Let's start. Tell me the core requirements for a URL shortener.",
    created_at: new Date().toISOString(),
    input_mode: null,
    transcript_confidence: null,
  },
];

const MOCK_COMPLETED_SESSION = {
  ...MOCK_SESSION,
  status: 'completed',
  ended_at: new Date().toISOString(),
  score_total: 38,
  score_requirements: 9,
  score_components: 8,
  score_scalability: 8,
  score_data_modeling: 7,
  score_communication: 6,
  summary: 'Good requirements coverage but missed consistent hashing discussion.',
  role_fit_summary: null,
};

test.beforeEach(async ({ page }) => {
  // Mock session detail
  await page.route('**/api/sessions/99', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session: MOCK_SESSION, messages: MOCK_MESSAGES }),
      });
    } else {
      route.continue();
    }
  });

  // Mock message stream response - returns SSE with a simple reply
  await page.route('**/api/sessions/99/messages', async (route) => {
    const sseBody = [
      'data: {"delta": "What approach would you use for the ID generation?"}\n\n',
      'data: {"done": true}\n\n',
    ].join('');
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    });
  });

  // Mock end session
  await page.route('**/api/sessions/99/end', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_COMPLETED_SESSION),
    })
  );
});

test('interview room loads with session question', async ({ page }) => {
  await page.goto('/interview/99');
  await expect(page.locator('.interview-room')).toBeVisible();
  await expect(page.locator('.room-question h1')).toContainText('Design a URL Shortener');
});

test('Alex panel is visible', async ({ page }) => {
  await page.goto('/interview/99');
  await expect(page.locator('.alex-panel')).toBeVisible();
  await expect(page.locator('.alex-panel')).toContainText('Alex');
});

test('text input area is visible', async ({ page }) => {
  await page.goto('/interview/99');
  await expect(page.locator('.message-input')).toBeVisible();
  await expect(page.locator('.send-btn')).toBeVisible();
});

test('webcam panel or video placeholder is visible', async ({ page }) => {
  await page.goto('/interview/99');
  // Either the video mirror or a placeholder should be present
  const videoPanel = page.locator('.video-panel');
  await expect(videoPanel).toBeVisible();
});

test('transcript shows Alex opening message', async ({ page }) => {
  await page.goto('/interview/99');
  const transcript = page.locator('.message-thread');
  await expect(transcript).toBeVisible();
  await expect(transcript).toContainText("core requirements");
});

test('submit a typed answer updates transcript', async ({ page }) => {
  await page.goto('/interview/99');
  // Type an answer
  await page.locator('.message-input').fill('I would use a hash-based approach with Base62 encoding.');
  await page.locator('.send-btn').click();
  // Candidate message should appear in transcript
  await expect(page.locator('.message-thread')).toContainText('Base62 encoding', { timeout: 8000 });
});

test('send button disabled when input is empty', async ({ page }) => {
  await page.goto('/interview/99');
  await expect(page.locator('.send-btn')).toBeDisabled();
});

test('end interview button exists for active session', async ({ page }) => {
  await page.goto('/interview/99');
  await expect(page.locator('.end-btn')).toBeVisible();
});

test('end interview shows confirm dialog', async ({ page }) => {
  await page.goto('/interview/99');
  await page.locator('.end-btn').click();
  await expect(page.locator('.confirm-dialog')).toBeVisible();
  await expect(page.locator('.confirm-dialog')).toContainText('End');
});

test('home button navigates to home from interview', async ({ page }) => {
  await page.goto('/interview/99');
  await page.locator('.room-actions .btn-text').filter({ hasText: 'Home' }).click();
  await expect(page).toHaveURL('/');
});

test('hold to talk button is visible', async ({ page }) => {
  await page.goto('/interview/99');
  const pttBtn = page.locator('.push-talk-btn');
  await expect(pttBtn).toBeVisible();
});
