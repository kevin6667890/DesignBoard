import { test, expect } from '@playwright/test';

const emptyProfile = { id: null, name: '', target_roles: [], target_locations: [], education: {}, work_authorization_notes: '', skills: {}, projects: [], preferences: {}, created_at: null, updated_at: null };
const analysis = {
  resume_profile: {
    name: 'Sample Candidate', education: { school: 'Example University', degree: 'BSc' }, target_roles: ['Software Engineer Intern'], target_locations: ['Waterloo'],
    skills: { languages: ['Python'], frontend: ['React'], backend: ['FastAPI'], databases: [], cloud_devops: [], ai_tools: [], testing: [], other: [] },
    projects: [{ name: 'Synthetic Project', description: 'Test project', tech_stack: ['Python'], relevance_tags: [] }], experience: [], preferred_domains: ['backend'], search_keywords: ['Python', 'FastAPI'], suggested_job_titles: ['Backend Developer Intern'], strengths: ['API project experience'], gaps: ['Add testing detail'],
  },
  recommended_search_queries: [{ label: 'Example', query: 'Backend Developer Intern Python', why: 'Matches demonstrated skills.' }],
  profile_summary: 'Candidate has backend project experience.',
};

test.beforeEach(async ({ page }) => {
  let profile = { ...emptyProfile };
  await page.route('**/api/career/profile', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: profile });
    if (route.request().method() === 'PUT') return route.fulfill({ json: profile });
    return route.continue();
  });
  await page.route('**/api/career/profile/analyze-resume', (route) => route.fulfill({ json: analysis }));
  await page.route('**/api/career/profile/apply-resume-analysis', (route) => {
    profile = { ...emptyProfile, ...analysis.resume_profile, id: 1, preferences: { search_keywords: analysis.resume_profile.search_keywords, suggested_job_titles: analysis.resume_profile.suggested_job_titles, preferred_domains: analysis.resume_profile.preferred_domains } };
    return route.fulfill({ json: profile });
  });
});

test('Resume Import is visible and validates empty input', async ({ page }) => {
  await page.goto('/career/profile');
  await expect(page.getByText('Resume Import')).toBeVisible();
  await page.getByText('Analyze Resume').click();
  await expect(page.getByRole('alert')).toContainText('Upload a PDF or paste resume text');
});

test('pasted synthetic resume previews and applies a profile', async ({ page }) => {
  await page.goto('/career/profile');
  await page.getByLabel('Paste resume text').fill('Sample Candidate\nExample University\nPython FastAPI project');
  await page.getByText('Analyze Resume').click();
  await expect(page.getByText('Extracted Profile')).toBeVisible();
  await expect(page.getByText('Synthetic Project')).toBeVisible();
  await page.getByText('Apply to Profile').click();
  await expect(page.locator('.form-success')).toContainText('Resume profile applied');
});

test('Chinese resume labels appear and profile can prefill search', async ({ page }) => {
  await page.goto('/career/profile');
  await page.locator('.language-control').first().getByRole('button').nth(1).click();
  await expect(page.getByText('简历导入')).toBeVisible();
  await page.getByLabel('粘贴简历文本').fill('Sample Candidate\nPython FastAPI');
  await page.getByText('分析简历').click();
  await page.getByText('应用到候选人资料').click();
  await page.goto('/career/search-agent');
  await page.getByText('从资料加载').click();
  await expect(page.getByLabel('目标岗位')).toHaveValue('Software Engineer Intern');
});
