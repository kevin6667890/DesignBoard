import { useEffect, useMemo, useState } from 'react';
import LanguageControls from '../components/LanguageControls';
import MainNav from '../components/MainNav';
import BackLink from '../components/ui/BackLink';
import CopyButton from '../components/ui/CopyButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import {
  extractSearchLeads,
  fetchPublicSearchPages,
  generateSearchPlan,
  getCandidateProfile,
  saveSearchLeads,
  type JobLead,
  type SearchPlanResponse,
} from '../lib/api';
import { useI18n } from '../i18n/useI18n';

const sourceOptions = ['Google', 'Company Careers', 'Greenhouse', 'Lever', 'Wellfound', 'Job Bank', 'University Career Portal', 'Manual Paste'];
const domainOptions = ['general', 'backend', 'frontend', 'fullstack', 'fintech', 'payments', 'infra', 'cloud', 'devops', 'data', 'ml_ai', 'security', 'mobile'];

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function leadLabel(lead: JobLead) {
  return `${lead.company_name || '-'} ${lead.role_title || '-'} ${lead.location || ''}`;
}

export default function CareerSearchAgent() {
  const { t, uiLanguage } = useI18n();
  const [targetRole, setTargetRole] = useState('');
  const [locationsText, setLocationsText] = useState('');
  const [term, setTerm] = useState('');
  const [domain, setDomain] = useState('general');
  const [keywordsText, setKeywordsText] = useState('');
  const [sources, setSources] = useState<string[]>(['Google', 'Company Careers', 'Greenhouse', 'Lever', 'Manual Paste']);
  const [remotePreference, setRemotePreference] = useState<'remote' | 'hybrid' | 'onsite' | 'any'>('any');
  const [experienceLevel, setExperienceLevel] = useState<'intern' | 'co-op' | 'new_grad' | 'any'>('intern');
  const [plan, setPlan] = useState<SearchPlanResponse | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [sourceHint, setSourceHint] = useState('Manual');
  const [publicUrls, setPublicUrls] = useState('');
  const [pageTexts, setPageTexts] = useState<Array<{ url: string; text: string | null; error: string | null }>>([]);
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getCandidateProfile>> | null>(null);

  useEffect(() => { getCandidateProfile().then(setProfile).catch(() => setProfile(null)); }, []);

  const loadProfile = () => {
    if (!profile) return;
    const suggestedTitles = profile.preferences.suggested_job_titles as string[] | undefined;
    const searchKeywords = profile.preferences.search_keywords as string[] | undefined;
    const preferredDomains = profile.preferences.preferred_domains as string[] | undefined;
    setTargetRole(profile.target_roles[0] || suggestedTitles?.[0] || '');
    setLocationsText(profile.target_locations.join(', '));
    setKeywordsText((searchKeywords || []).join(', '));
    setDomain(preferredDomains?.[0] || 'general');
    const roles = profile.target_roles.join(' ').toLowerCase();
    setExperienceLevel(roles.includes('co-op') ? 'co-op' : roles.includes('new grad') ? 'new_grad' : 'intern');
  };

  const locations = useMemo(() => splitList(locationsText), [locationsText]);
  const keywords = useMemo(() => splitList(keywordsText), [keywordsText]);
  const selectedLeads = leads.filter((_, idx) => selected.has(idx));

  const toggleSource = (source: string) => {
    setSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source]);
  };

  const generatePlan = async () => {
    setBusy(t('generatingSearchPlan'));
    setError('');
    setSavedCount(null);
    try {
      const result = await generateSearchPlan({
        target_role: targetRole,
        locations,
        term,
        domain,
        keywords,
        sources,
        remote_preference: remotePreference,
        experience_level: experienceLevel,
        output_language: uiLanguage,
      });
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedSearchPlan'));
    } finally {
      setBusy('');
    }
  };

  const mergeLeads = (next: JobLead[]) => {
    setLeads((current) => {
      const combined = [...current, ...next];
      setSelected(new Set(combined.map((lead, idx) => !lead.duplicate_warning ? idx : -1).filter((idx) => idx >= 0)));
      return combined;
    });
  };

  const extractLeads = async () => {
    setBusy(t('extractingLeads'));
    setError('');
    setSavedCount(null);
    try {
      const result = await extractSearchLeads({
        pasted_text: pastedText,
        source_hint: sourceHint,
        target_role: targetRole,
        locations,
        output_language: uiLanguage,
      });
      setLeads(result.job_leads);
      setSelected(new Set(result.job_leads.map((lead, idx) => !lead.duplicate_warning ? idx : -1).filter((idx) => idx >= 0)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedExtraction'));
    } finally {
      setBusy('');
    }
  };

  const fetchPublicPages = async () => {
    setBusy(t('fetchingPublicPages'));
    setError('');
    setSavedCount(null);
    try {
      const result = await fetchPublicSearchPages({
        urls: publicUrls.split('\n').map((url) => url.trim()).filter(Boolean),
        source_hint: sourceHint,
        output_language: uiLanguage,
      });
      setPageTexts(result.pages);
      mergeLeads(result.job_leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedFetch'));
    } finally {
      setBusy('');
    }
  };

  const saveLeads = async (parseAndScore = false) => {
    setBusy(parseAndScore ? t('savingParsingScoring') : t('savingLeads'));
    setError('');
    try {
      const result = await saveSearchLeads({ leads: selectedLeads, parse_and_score: parseAndScore, output_language: uiLanguage });
      setSavedCount(result.saved_jobs.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedSave'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="career-page">
      <header className="home-header">
        <div className="logo-area">
          <h1 className="wordmark">{t('jobSearchAgent')}</h1>
          <p className="tagline">{t('internshipRadar')}</p>
        </div>
        <MainNav />
      </header>
      <LanguageControls />
      <div className="page-back-row"><BackLink to="/career" label={t('backToCareerMode')} /></div>

      <section className="career-panel profile-form">
        <div className="panel-title-row">
          <h2>{t('searchRequest')}</h2>
          <div className="career-actions"><button className="btn-text" onClick={loadProfile} disabled={!profile?.id}>{t('loadFromProfile')}</button><button className="btn-filled" onClick={generatePlan} disabled={!!busy || !targetRole.trim()}>{busy === t('generatingSearchPlan') ? t('generatingSearchPlan') : t('generateSearchPlan')}</button></div>
        </div>
        <div className="career-search-grid">
          <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder={t('targetRole')} aria-label={t('targetRole')} />
          <input value={locationsText} onChange={(e) => setLocationsText(e.target.value)} placeholder={t('location')} aria-label={t('location')} />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('term')} aria-label={t('term')} />
          <select value={domain} onChange={(e) => setDomain(e.target.value)} aria-label={t('domain')}>{domainOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder={t('keywords')} aria-label={t('keywords')} />
          <select value={remotePreference} onChange={(e) => setRemotePreference(e.target.value as typeof remotePreference)} aria-label={t('remotePreference')}>
            {['any', 'remote', 'hybrid', 'onsite'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as typeof experienceLevel)} aria-label={t('experienceLevel')}>
            {['intern', 'co-op', 'new_grad', 'any'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="source-toggle-list" aria-label={t('source')}>
          {sourceOptions.map((source) => (
            <label key={source} className="source-toggle"><input type="checkbox" checked={sources.includes(source)} onChange={() => toggleSource(source)} />{source}</label>
          ))}
        </div>
      </section>

      {busy && <section className="career-panel"><LoadingSpinner message={busy} inline /></section>}
      {error && <section className="career-panel"><ErrorState message={error} /></section>}
      {savedCount !== null && <section className="career-panel"><p className="form-success">{t('savedLeadsCount')}: {savedCount}</p></section>}

      <section className="career-panel">
        <h2>{t('searchPlan')}</h2>
        {!plan ? <EmptyState message={t('noGeneratedQueries')} /> : (
          <>
            <p className="blueprint-summary">{plan.search_summary}</p>
            <div className="query-list">
              {plan.recommended_queries.map((query, idx) => (
                <div className="query-row search-agent-query" key={`${query.source}-${idx}`}>
                  <strong>{query.source}</strong>
                  <code>{query.query}</code>
                  <CopyButton text={query.query} label={t('copyQuery')} copiedLabel={t('copied')} />
                  <a className="btn-text small" href={query.url} target="_blank" rel="noreferrer">{t('openSearch')}</a>
                  <span className="muted">{query.why}</span>
                </div>
              ))}
            </div>
            <div className="blueprint-grid search-agent-steps">
              <section className="blueprint-section"><h3>{t('sourceStrategy')}</h3>{plan.source_strategy.map((item) => <p key={item.source} className="muted"><strong>{item.source}</strong>: {item.instructions}</p>)}</section>
              <section className="blueprint-section"><h3>{t('manualSteps')}</h3><ul>{plan.manual_steps.map((step) => <li key={step}>{step}</li>)}</ul></section>
            </div>
          </>
        )}
      </section>

      <section className="career-panel profile-form">
        <h2>{t('importSearchResults')}</h2>
        <select value={sourceHint} onChange={(e) => setSourceHint(e.target.value)} aria-label={t('source')}>
          {['Google', 'LinkedIn', 'Indeed', 'Company Careers', 'Greenhouse', 'Lever', 'Job Bank', 'Manual', 'unknown'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder={t('pastedResultsText')} aria-label={t('pastedResultsText')} />
        <button className="btn-filled" onClick={extractLeads} disabled={!!busy || !pastedText.trim()}>{t('extractJobLeads')}</button>
      </section>

      <section className="career-panel profile-form">
        <h2>{t('publicUrls')}</h2>
        <textarea value={publicUrls} onChange={(e) => setPublicUrls(e.target.value)} placeholder={t('publicUrlsPlaceholder')} aria-label={t('publicUrls')} />
        <button className="btn-text" onClick={fetchPublicPages} disabled={!!busy || !publicUrls.trim()}>{t('fetchPublicPages')}</button>
        {pageTexts.length > 0 && <div className="fetched-page-list">{pageTexts.map((page) => <p key={page.url} className={page.error ? 'form-error' : 'muted'}>{page.url}: {page.error || `${page.text?.length || 0} chars`}</p>)}</div>}
      </section>

      <section className="career-panel">
        <div className="panel-title-row">
          <h2>{t('reviewLeads')}</h2>
          <div className="career-actions">
            <button className="btn-text small" onClick={() => setSelected(new Set(leads.map((lead, idx) => !lead.duplicate_warning ? idx : -1).filter((idx) => idx >= 0)))}>{t('saveAllNonDuplicates')}</button>
            <button className="btn-filled" onClick={() => saveLeads(false)} disabled={!selectedLeads.length || !!busy}>{t('saveSelected')}</button>
            <button className="btn-text" onClick={() => saveLeads(true)} disabled={!selectedLeads.length || !!busy}>{t('saveParseScore')}</button>
          </div>
        </div>
        {!leads.length ? <EmptyState message={t('noLeadsFound')} /> : (
          <div className="lead-review-list">
            {leads.map((lead, idx) => (
              <article className="lead-card" key={`${leadLabel(lead)}-${idx}`}>
                <div className="lead-card-head">
                  <label className="source-toggle"><input type="checkbox" checked={selected.has(idx)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(idx) ? next.delete(idx) : next.add(idx); return next; })} />{lead.company_name || '-'}</label>
                  <div className="lead-badges">
                    <StatusBadge label={`${t('confidence')} ${lead.confidence ?? 0}`} variant="info" />
                    {lead.needs_jd && <StatusBadge label={t('needsJd')} variant="warning" />}
                    {lead.duplicate_warning && <StatusBadge label={t('possibleDuplicate')} variant="warning" />}
                  </div>
                </div>
                <h3>{lead.role_title || t('needsJd')}</h3>
                <p className="muted">{lead.location || '-'} | {lead.source || '-'}</p>
                {lead.snippet && <p>{lead.snippet}</p>}
                {lead.reason && <p className="muted">{lead.reason}</p>}
                {lead.duplicate_warning && <p className="form-error">{lead.duplicate_warning}</p>}
                <div className="job-url-row">
                  {lead.job_url && <a className="btn-text small" href={lead.job_url} target="_blank" rel="noreferrer">{t('jobUrl')}</a>}
                  {lead.application_url && <a className="btn-text small" href={lead.application_url} target="_blank" rel="noreferrer">{t('openApplication')}</a>}
                  <button className="btn-text small" onClick={() => setLeads((current) => current.filter((_, itemIdx) => itemIdx !== idx))}>{t('discard')}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
