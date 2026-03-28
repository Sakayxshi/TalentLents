import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore, ExternalCandidate } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { getScoreColor, scoreExternalCandidate, RankingMode, SALARY_BAND_MIDPOINTS } from '@/lib/scoring';
import { Star, X, GitCompare, Sparkles, Brain, Upload } from 'lucide-react';
import { generateExternalCandidates } from '@/lib/demoData';
import { useToast } from '@/hooks/use-toast';
import { invokeAI, CandidateEvaluations } from '@/lib/aiService';
import Papa from 'papaparse';

type SortMode = 'best' | 'fast' | 'cost' | 'long';

const SORT_TO_RANKING: Record<SortMode, RankingMode> = {
  best: 'best_overall',
  fast: 'fastest',
  cost: 'lowest_cost',
  long: 'long_term',
};

export default function CandidateRankingPage() {
  const { shortlistedCandidates, shortlistCandidate, unshortlistCandidate, externalCandidates, setExternalCandidates, scenarios, selectedScenarioId, markPageComplete, projectConfig } = useStore();
  const { toast } = useToast();
  const [aiEvals, setAiEvals] = useState<CandidateEvaluations | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const positions = useMemo(() => scenario?.roles.filter(r => r.gap > 0).map(r => r.role) || [], [scenario]);

  const scoreCandidates = useCallback((candidates: ExternalCandidate[], mode: RankingMode): ExternalCandidate[] => {
    return candidates.map(c => {
      const role = scenario?.roles.find(r => r.role === c.targetRole);
      const salaryBandMax = SALARY_BAND_MIDPOINTS[role ? 'E4' : 'E4'] * 1.1;
      const result = scoreExternalCandidate(
        c.technical_skills || '',
        c.years_experience,
        c.certifications || '',
        c.education || '',
        c.current_company,
        c.current_role,
        c.salary_expectation,
        c.notice_period_weeks,
        role?.requiredSkills || [],
        role?.requiredCerts || [],
        salaryBandMax,
        mode
      );
      return { ...c, composite_score: result.composite, skill_match: result.breakdown.skillMatch };
    });
  }, [scenario]);

  useEffect(() => {
    if (externalCandidates.length === 0 && positions.length > 0) {
      const candidates = generateExternalCandidates(positions);
      setExternalCandidates(scoreCandidates(candidates, 'best_overall'));
    }
  }, [externalCandidates.length, positions, scoreCandidates, setExternalCandidates]);

  const handleCsvUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          const parsed: ExternalCandidate[] = rows
            .filter(r => r.name)
            .map((r, i) => ({
              id: `csv-${i}-${Date.now()}`,
              name: r.name || '',
              current_company: r.current_company || r.company || '',
              current_role: r.current_role || r.role || '',
              targetRole: r.target_role || r.targetRole || positions[0] || '',
              years_experience: Number(r.years_experience || r.years_exp) || 0,
              education: r.education || '',
              technical_skills: r.technical_skills || r.skills || '',
              certifications: r.certifications || '',
              languages: r.languages || '',
              salary_expectation: Number(r.salary_expectation || r.salary) || 70000,
              notice_period_weeks: Number(r.notice_period_weeks || r.notice_period) || 8,
              portfolio_summary: r.portfolio_summary || '',
              location: r.location || '',
            }));
          setExternalCandidates(scoreCandidates(parsed, SORT_TO_RANKING[sortMode]));
          toast({ title: 'Candidates Uploaded', description: `${parsed.length} external candidates loaded` });
        },
      });
    };
    input.click();
  }, [positions, scoreCandidates, setExternalCandidates, sortMode, toast]);

  const [selectedPosition, setSelectedPosition] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    if (positions.length > 0 && !selectedPosition) setSelectedPosition(positions[0]);
  }, [positions, selectedPosition]);

  const candidates = useMemo(() => {
    const filtered = externalCandidates.filter(c => c.targetRole === selectedPosition);
    // Re-score with current mode weights, then sort by composite score
    const rescored = scoreCandidates(filtered, SORT_TO_RANKING[sortMode]);
    return [...rescored].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));
  }, [externalCandidates, selectedPosition, sortMode, scoreCandidates]);

  const handleAiAnalyze = async () => {
    if (!selectedPosition || candidates.length === 0) return;
    setLoadingAi(true);
    try {
      const role = scenario?.roles.find(r => r.role === selectedPosition);
      const result = await invokeAI<CandidateEvaluations>('analyze-candidates', {
        candidates: candidates.slice(0, 8).map(c => ({
          candidateId: c.id,
          name: c.name,
          currentRole: c.current_role,
          company: c.current_company,
          yearsExp: c.years_experience,
          skills: c.technical_skills,
          score: c.composite_score || 0,
          salary: c.salary_expectation,
        })),
        targetRole: selectedPosition,
        requiredSkills: role?.requiredSkills || [],
        projectContext: projectConfig?.name || 'Strategic Initiative',
      });
      setAiEvals(result);
      toast({ title: 'AI Analysis Complete', description: `${result.evaluations.length} candidates evaluated` });
    } catch (err) {
      console.error('Candidate analysis failed:', err);
      toast({ title: 'Analysis Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoadingAi(false);
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  const compareData = externalCandidates.filter(c => compareIds.includes(c.id));
  const getEval = (id: string) => aiEvals?.evaluations.find(e => e.candidateId === id);

  const fitColors: Record<string, string> = { 'Strong Fit': 'badge-green', 'Good Fit': 'badge-blue', 'Moderate Fit': 'badge-amber', 'Weak Fit': 'badge-red' };
  const recColors: Record<string, string> = { 'Hire': 'badge-green', 'Interview': 'badge-blue', 'Waitlist': 'badge-amber', 'Pass': 'badge-red' };

  if (!scenario) {
    return (
      <div>
        <PageHeader title="Candidate Ranking" />
        <div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario first.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Candidate Ranking" subtitle="Evaluate and compare external candidates">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCsvUpload}>
            <Upload size={14} className="mr-2" />Upload CSV
          </Button>
          <Button size="sm" onClick={handleAiAnalyze} disabled={loadingAi || candidates.length === 0}>
            <Sparkles size={14} className="mr-2" />{loadingAi ? 'Analyzing...' : aiEvals ? 'Re-Analyze' : 'AI Evaluate'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCompareIds([])} disabled={compareIds.length === 0}>
            <GitCompare size={14} className="mr-2" />Compare ({compareIds.length})
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Candidates" value={externalCandidates.length} />
        <MetricCard label="Shortlisted" value={shortlistedCandidates.length} />
        <MetricCard label="Avg Score" value={externalCandidates.length > 0 ? Math.round(externalCandidates.reduce((a, c) => a + (c.composite_score || 0), 0) / externalCandidates.length) : 0} />
        <MetricCard label="Positions" value={positions.length} />
      </div>

      {/* AI Hiring Strategy */}
      {aiEvals && (
        <div className="card-surface p-5 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">AI Hiring Strategy</h3>
            {aiEvals.topPick && <Badge variant="badge-green">Top Pick: {aiEvals.topPick}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{aiEvals.hiringStrategy}</p>
        </div>
      )}

      <div className="flex gap-4">
        <div className="w-[35%] shrink-0 space-y-2">
          {positions.map(p => {
            const count = externalCandidates.filter(c => c.targetRole === p).length;
            const topScore = externalCandidates.filter(c => c.targetRole === p).reduce((max, c) => Math.max(max, c.composite_score || 0), 0);
            return (
              <button key={p} onClick={() => { setSelectedPosition(p); setAiEvals(null); }} className={`w-full text-left card-surface p-4 transition-all ${selectedPosition === p ? 'ring-2 ring-primary' : ''}`}>
                <h4 className="font-medium text-foreground text-sm">{p}</h4>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{count} applicants</span>
                  <span>Top: <span className={getScoreColor(topScore)}>{topScore}</span></span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex gap-2 mb-4">
            {([['best','Best Fit'],['fast','Fastest Onboard'],['cost','Lowest Cost'],['long','Long-term']] as [SortMode, string][]).map(([mode, label]) => (
              <Button key={mode} size="sm" variant={sortMode === mode ? 'default' : 'outline'} onClick={() => setSortMode(mode)}>{label}</Button>
            ))}
          </div>

          {candidates.map(c => {
            const isShortlisted = shortlistedCandidates.includes(c.id);
            const candidateSkills = (c.technical_skills || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
            const certs = (c.certifications || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
            const evalData = getEval(c.id);
            return (
              <div key={c.id} className="card-surface p-4 animate-fade-in-up">
                <div className="flex items-start gap-4">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${getScoreColor(c.composite_score || 0)}`}>{c.composite_score || 0}</p>
                    <p className="text-[10px] text-muted-foreground">SCORE</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{c.name}</h4>
                          {evalData && <Badge variant={fitColors[evalData.fitLevel]}>{evalData.fitLevel}</Badge>}
                          {evalData && <Badge variant={recColors[evalData.recommendation]}>{evalData.recommendation}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{c.current_company} · {c.current_role} · {c.years_experience} yrs</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>€{c.salary_expectation.toLocaleString()}</p>
                        <p>{c.notice_period_weeks === 0 ? 'Immediate' : `${c.notice_period_weeks}w notice`}</p>
                      </div>
                    </div>
                    <div className="mt-2 mb-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Skill Match</span><span>{c.skill_match || 0}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(c.skill_match || 0) >= 70 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${c.skill_match || 0}%` }} />
                      </div>
                    </div>
                    {/* AI insights */}
                    {evalData && (
                      <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10 text-xs">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-success font-medium mb-1">Strengths</p>
                            {evalData.strengths.map((s, i) => <p key={i} className="text-muted-foreground">• {s}</p>)}
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-destructive font-medium mb-1">Concerns</p>
                            {evalData.concerns.map((s, i) => <p key={i} className="text-muted-foreground">• {s}</p>)}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {candidateSkills.slice(0, 5).map(s => <span key={s} className="px-2 py-0.5 text-xs rounded badge-green">{s}</span>)}
                      {certs.slice(0, 2).map(cert => <span key={cert} className="px-2 py-0.5 text-xs rounded badge-blue">{cert}</span>)}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant={isShortlisted ? 'outline' : 'default'} onClick={() => {
                        if (isShortlisted) { unshortlistCandidate(c.id); }
                        else { shortlistCandidate(c.id); markPageComplete(7); toast({ title: 'Shortlisted', description: c.name }); }
                      }}>
                        <Star size={13} className={`mr-1 ${isShortlisted ? 'fill-current' : ''}`} />
                        {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive"><X size={13} className="mr-1" />Reject</Button>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer ml-auto">
                        <input type="checkbox" checked={compareIds.includes(c.id)} onChange={() => toggleCompare(c.id)} className="accent-primary" />
                        Compare
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {compareData.length >= 2 && (
        <div className="card-surface p-5 mt-6 animate-fade-in-up">
          <h3 className="font-semibold text-foreground mb-4">Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-xs text-muted-foreground">Attribute</th>
                {compareData.map(c => <th key={c.id} className="text-left p-2 text-xs text-foreground">{c.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Score', key: 'composite_score' },
                { label: 'Skill Match', key: 'skill_match' },
                { label: 'Experience', key: 'years_experience' },
                { label: 'Salary', key: 'salary_expectation' },
                { label: 'Notice', key: 'notice_period_weeks' },
                { label: 'Education', key: 'education' },
                { label: 'Location', key: 'location' },
              ].map(attr => {
                const values = compareData.map(c => (c as any)[attr.key]);
                const numValues = values.filter((v): v is number => typeof v === 'number');
                const best = attr.key === 'salary_expectation' || attr.key === 'notice_period_weeks'
                  ? Math.min(...numValues) : Math.max(...numValues);
                return (
                  <tr key={attr.key} className="border-b border-border">
                    <td className="p-2 text-muted-foreground">{attr.label}</td>
                    {compareData.map(c => {
                      const val = (c as any)[attr.key];
                      const isBest = typeof val === 'number' && val === best;
                      return (
                        <td key={c.id} className={`p-2 ${isBest ? 'text-success font-medium' : 'text-foreground'}`}>
                          {attr.key === 'salary_expectation' ? `€${val.toLocaleString()}` : attr.key === 'notice_period_weeks' ? (val === 0 ? 'Immediate' : `${val}w`) : typeof val === 'number' ? val : val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
