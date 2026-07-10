import { test, expect, type Page } from '@playwright/test';

/**
 * paste-job-page.spec.ts
 * Tests: Paste Job Page route loads, validation, analysis results, save flow, i18n.
 * All backend API calls are mocked — DeepSeek is never called.
 */

const EMPTY_PROFILE = {
  id: null, name: '', target_roles: [], target_locations: [],
  education: {}, work_authorization_notes: '', skills: {}, projects: [], preferences: {},
  created_at: null, updated_at: null,
};

const MOCK_JOB = {
  id: 99, company_name: 'Point72', role_title: 'Network Engineer',
  location: 'New York, NY', job_url: null, application_url: null,
  source: 'Pasted Page', raw_job_description: 'Full JD text',
  parsed_job: null, fit_score: 22, fit_summary: 'Not a match.',
  fit_breakdown: null, status: 'saved', priority: 'low',
  notes: 'Created from Pasted Job Page.', created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_JOB_ANALYSIS = {
  is_job_posting: true,
  confidence: 95,
  extracted_job: {
    company_name: 'Point72',
    role_title: 'Network Engineer',
    location: 'New York, NY | Stamford, CT',
    experience_level: 'experienced',
    employment_type: 'full_time',
    term: null,
    domain: 'network',
    source: 'LinkedIn',
    job_url: null,
    application_url: null,
    salary_range: null,
    deadline: null,
    application_checklist: [],
    tech_stack: {
      languages: ['Python', 'Ansible'],
      frontend: [],
      backend: [],
      databases: [],
      cloud_devops: [],
      networking: ['BGP', 'OSPF', 'EVPN/VXLAN', 'STP', 'VLANs'],
      ai_tools: [],
      testing: [],
      other: ['Cisco', 'Arista', 'Palo Alto'],
    },
    responsibilities: ['Design and manage network infrastructure', 'Support low-latency trading systems'],
    requirements: ['5+ years of network engineering experience', 'BGP, OSPF, VLAN expertise'],
    nice_to_have: ['Experience with financial services'],
    risk_flags: ['Experienced role', 'Seniority mismatch', 'Not an internship', 'Location mismatch'],
    summary: 'Senior network engineering role for a financial firm.',
  },
  fit: {
    overall_score: 22,
    decision: 'skip',
    priority: 'low',
    summary: 'This is an experienced network engineering role requiring 5+ years. Not suitable for internship-level candidates.',
    main_reason: 'Requires 5+ years of network engineering and is not an internship/new-grad SWE role.',
    breakdown: {
      role_match: 10, tech_stack_match: 20, location_match: 30,
      experience_level_match: 5, project_relevance: 15, application_risk: 70,
    },
    matched_strengths: [],
    gaps: ['5+ years experience required', 'Network engineering specialization', 'Not an internship'],
    risk_flags: ['Experienced role', 'Seniority mismatch', 'Not an internship'],
    recommended_resume_keywords: ['BGP', 'OSPF', 'Cisco'],
    recommended_projects_to_highlight: [],
    next_action: 'skip',
  },
  cleaned_jd_text: 'Network Engineer\nPoint72\nNew York, NY | Stamford, CT\n5+ years required...',
  ignored_noise: ['Cookie banner removed', 'Navigation menu removed'],
};

const MOCK_NOT_JOB_ANALYSIS = {
  is_job_posting: false,
  confidence: 85,
  reason: 'This appears to be a company home page, not a specific job posting.',
  possible_next_steps: [
    'Navigate to the careers section and paste a specific job listing.',
    'Try copying a single job posting page instead.',
  ],
};

const MOCK_SAVE_RESPONSE = {
  job: MOCK_JOB,
  prepared_interview: null,
  next_route: `/career/jobs/${MOCK_JOB.id}`,
};

async function setupMocks(page: Page) {
  await page.route('**/api/career/profile', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_PROFILE) })
  );
  await page.route('**/api/career/jobs', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_JOB]) });
    } else {
      route.continue();
    }
  });
  await page.route('**/api/career/jobs/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOB) })
  );
}

// ===== Test 1: Route loads =====
test('paste job page route loads', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/career/paste-job');
  await expect(page.locator('h1.wordmark')).toBeVisible();
  await expect(page.locator('#paste-job-text')).toBeVisible();
  await expect(page.locator('#paste-analyze-btn')).toBeVisible();
  await expect(page.locator('#paste-analyze-btn')).toBeDisabled();
});

// ===== Test 2: Empty textarea validation =====
test('analyze button is disabled when textarea is empty', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/career/paste-job');
  const btn = page.locator('#paste-analyze-btn');
  await expect(btn).toBeDisabled();
  await page.locator('#paste-job-text').fill('hello');
  await expect(btn).toBeEnabled();
  await page.locator('#paste-job-text').fill('');
  await expect(btn).toBeDisabled();
});

// ===== Test 3: Short text warning =====
test('short text warning appears for short input', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/career/paste-job');
  await page.locator('#paste-job-text').fill('Short text.');
  await expect(page.locator('.paste-warning')).toBeVisible();
});

// ===== Test 4: Analyze job — successful result renders =====
test('analyze job with mocked success renders decision card and fields', async ({ page }) => {
  await setupMocks(page);
  await page.route('**/api/career/paste/analyze', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOB_ANALYSIS) })
  );

  await page.goto('/career/paste-job');
  const textarea = page.locator('#paste-job-text');
  await textarea.fill('Point72 Network Engineer New York 5+ years BGP OSPF VLAN Cisco Arista Palo Alto Python Ansible Financial Services.');
  await page.locator('#paste-analyze-btn').click();

  // Decision card visible
  await expect(page.locator('#paste-decision')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#paste-match-score')).toContainText('22/100');
  await expect(page.locator('#paste-main-reason')).toBeVisible();

  // Extracted company and role
  await expect(page.locator('#paste-company')).toContainText('Point72');
  await expect(page.locator('#paste-role')).toContainText('Network Engineer');

  // Risk flags section
  await expect(page.locator('text=Risk Flags').first()).toBeVisible();
  await expect(page.locator('text=Experienced role').first()).toBeVisible();

  // Save actions visible
  await expect(page.locator('#paste-save-to-tracker')).toBeVisible();
  await expect(page.locator('#paste-save-parse-score')).toBeVisible();
  await expect(page.locator('#paste-save-prepare-interview')).toBeVisible();
});

// ===== Test 5: Non-job text renders not-job state =====
test('analyze non-job text with mocked response renders not-job state', async ({ page }) => {
  await setupMocks(page);
  await page.route('**/api/career/paste/analyze', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_NOT_JOB_ANALYSIS) })
  );

  await page.goto('/career/paste-job');
  await page.locator('#paste-job-text').fill('Welcome to Point72. We are a leading financial firm. Lorem ipsum dolor sit amet consectetur.');
  await page.locator('#paste-analyze-btn').click();

  await expect(page.locator('text=does not look like a job posting')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=company home page')).toBeVisible();
});

// ===== Test 6: Save to Tracker navigates to job detail =====
test('save to tracker with mocked response navigates to job detail', async ({ page }) => {
  await setupMocks(page);
  await page.route('**/api/career/paste/analyze', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOB_ANALYSIS) })
  );
  await page.route('**/api/career/paste/save', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SAVE_RESPONSE) })
  );

  await page.goto('/career/paste-job');
  await page.locator('#paste-job-text').fill('Point72 Network Engineer New York 5+ years BGP OSPF.');
  await page.locator('#paste-analyze-btn').click();
  await expect(page.locator('#paste-save-to-tracker')).toBeVisible({ timeout: 10000 });
  await page.locator('#paste-save-to-tracker').click();

  await expect(page).toHaveURL(`/career/jobs/${MOCK_JOB.id}`, { timeout: 8000 });
});

// ===== Test 7: Chinese UI labels appear when language is zh =====
test('chinese UI labels appear when language is zh', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/career/paste-job');
  // Click the Chinese language toggle button
  await page.locator('button', { hasText: '中文' }).first().click();

  await expect(page.locator('h1.wordmark')).toContainText('粘贴岗位页面');
  await expect(page.locator('#paste-analyze-btn')).toContainText('分析岗位');
});

// ===== Test 8: Career home shows paste job CTA =====
test('career home shows paste job CTA as primary element', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/career');

  await expect(page.locator('#career-paste-job-cta')).toBeVisible();
  await expect(page.locator('#career-paste-job-btn')).toBeVisible();
});
