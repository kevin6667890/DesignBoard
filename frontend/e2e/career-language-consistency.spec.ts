import { test, expect, type Page } from '@playwright/test';

const profile = { id: null, name: '', target_roles: [], target_locations: [], education: {}, work_authorization_notes: '', skills: {}, projects: [], preferences: {}, created_at: null, updated_at: null };

const chineseAnalysis = {
  is_job_posting: true,
  confidence: 96,
  extracted_job: {
    company_name: 'Aptiv', role_title: 'Engineering Intern', location: 'Toronto', experience_level: 'intern', employment_type: 'internship', term: 'Summer 2026', domain: 'fullstack', source: 'Pasted Page', job_url: null, application_url: null, salary_range: null, deadline: null,
    application_checklist: [], tech_stack: { languages: ['Python'], frontend: ['React'], backend: ['Node.js'], databases: [], cloud_devops: [], networking: [], ai_tools: [], testing: [], other: [] },
    responsibilities: ['参与工程项目开发'], requirements: ['熟悉 Python 或 React'], nice_to_have: [], risk_flags: ['Node.js 经验不足'], summary: 'Aptiv 在 Toronto 招聘 Engineering Intern。',
  },
  fit: {
    overall_score: 72, decision: 'maybe', priority: 'medium', summary: '该实习岗位与候选人的目标地点和工程方向较为匹配。', main_reason: '该岗位是实习岗位，地点为 Toronto，与候选人的目标方向部分匹配；但需要补足 React、Node.js 和 TypeScript 相关经验。',
    breakdown: { role_match: 80, tech_stack_match: 65, location_match: 90, experience_level_match: 95, project_relevance: 70, application_risk: 20 }, matched_strengths: ['Python 项目经验'], gaps: ['React 项目经验不足'], risk_flags: ['Node.js 经验不足'], recommended_resume_keywords: ['Python', 'React'], recommended_projects_to_highlight: ['相关工程项目'], next_action: 'tailor_resume',
  },
  cleaned_jd_text: 'Aptiv Engineering Intern Toronto', ignored_noise: [],
};

async function mockPage(page: Page, expectedLanguage: () => 'en' | 'zh') {
  await page.route('**/api/career/profile', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(profile) }));
  await page.route('**/api/career/paste/analyze', async (route) => {
    expect(JSON.parse(route.request().postData() || '{}').output_language).toBe(expectedLanguage());
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(chineseAnalysis) });
  });
}

test('Paste Job sends Chinese UI language and displays Chinese main reason', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('designboard_ui_language', 'zh'));
  await mockPage(page, () => 'zh');
  await page.goto('/career/paste-job');
  await page.locator('#paste-job-text').fill('Aptiv Engineering Intern Toronto React Node.js TypeScript');
  await page.locator('#paste-analyze-btn').click();
  await expect(page.locator('#paste-main-reason')).toContainText('该岗位是实习岗位');

});

test('Paste Job sends English UI language after switching back to English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('designboard_ui_language', 'en'));
  await mockPage(page, () => 'en');
  await page.goto('/career/paste-job');
  await page.locator('#paste-job-text').fill('Aptiv Engineering Intern Toronto React Node.js TypeScript');
  await page.locator('#paste-analyze-btn').click();
  await expect(page.locator('#paste-main-reason')).toBeVisible();
});
