import { useState, useMemo, useEffect } from 'react';
import { useStore, ExternalCandidate } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { getScoreColor, calculateCompositeScore, getSkillOverlap } from '@/lib/scoring';
import { Star, X, GitCompare } from 'lucide-react';
import { generateExternalCandidates } from '@/lib/demoData';
import { useToast } from '@/hooks/use-toast';

type SortMode = 'best' | 'fast' | 'cost' | 'long';

export default function CandidateRankingPage() {
  const { shortlistedCandidates, shortlistCandidate, unshortlistCandidate, externalCandidates, setExternalCandidates, scenarios, selectedScenarioId, markPageComplete } = useStore();
  const { toast } = useToast();

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const positions = useMemo(() => scenario?.roles.filter(r => r.gap > 0).map(r => r.role) || [], [scenario]);

  // Generate candidates if none exist
  useEffect(() => {
    if (externalCandidates.length === 0 && positions.length > 0) {
      const candidates = generateExternalCandidates(positions);
      // Score each candidate
      const scored = candidates.map(c => {
        const role = scenario?.roles.find(r => r.role === c.targetRole);
        const candidateSkills = (c.technical_skills || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
        const skillMatch = role ? Math.round(getSkillOverlap(candidateSkills, role.requiredSkills) * 100) : 50;
        const baseScore = Math.round(
          skillMatch * 0.3 +
          Math.min(c.years_experience / 15, 1) * 100 * 0.2 +
          (c.certifications ? 70 : 30) * 0.15 +
          (c.education?.includes('M.Sc') || c.education?.includes('Ph.D') ? 80 : 60) * 0.1 +
          (c.notice_period_weeks <= 4 ? 90 : c.notice_period_weeks <= 8 ? 70 : 50) * 0.1 +
          60 * 0.15
        );
        return { ...c, composite_score: Math.min(100, Math.max(20, baseScore)), skill_match: skillMatch };
      });
      setExternalCandidates(scored);
    }
  }, [externalCandidates.length, positions, scenario, setExternalCandidates]);

  const [selectedPosition, setSelectedPosition] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Default to first position
  useEffect(() => {
    if (positions.length > 0 && !selectedPosition) setSelectedPosition(positions[0]);
  }, [positions, selectedPosition]);

  const candidates = useMemo(() => {
    let filtered = externalCandidates.filter(c => c.targetRole === selectedPosition);
    switch (sortMode) {
      case 'fast': return [...filtered].sort((a, b) => a.notice_period_weeks - b.notice_period_weeks);
      case 'cost': return [...filtered].sort((a, b) => a.salary_expectation - b.salary_expectation);
      case 'long': return [...filtered].sort((a, b) => b.years_experience - a.years_experience);
      default: return [...filtered].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));
    }
  }, [externalCandidates, selectedPosition, sortMode]);

  const toggleCompare = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  const compareData = externalCandidates.filter(c => compareIds.includes(c.id));

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
        <Button variant="outline" size="sm" onClick={() => setCompareIds([])} disabled={compareIds.length === 0}>
          <GitCompare size={14} className="mr-2" />Compare ({compareIds.length})
        </Button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Candidates" value={externalCandidates.length} />
        <MetricCard label="Shortlisted" value={shortlistedCandidates.length} />
        <MetricCard label="Avg Score" value={externalCandidates.length > 0 ? Math.round(externalCandidates.reduce((a, c) => a + (c.composite_score || 0), 0) / externalCandidates.length) : 0} />
        <MetricCard label="Positions" value={positions.length} />
      </div>

      <div className="flex gap-4">
        {/* Left */}
        <div className="w-[35%] shrink-0 space-y-2">
          {positions.map(p => {
            const count = externalCandidates.filter(c => c.targetRole === p).length;
            const topScore = externalCandidates.filter(c => c.targetRole === p).reduce((max, c) => Math.max(max, c.composite_score || 0), 0);
            return (
              <button key={p} onClick={() => setSelectedPosition(p)} className={`w-full text-left card-surface p-4 transition-all ${selectedPosition === p ? 'ring-2 ring-primary' : ''}`}>
                <h4 className="font-medium text-foreground text-sm">{p}</h4>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{count} applicants</span>
                  <span>Top: <span className={getScoreColor(topScore)}>{topScore}</span></span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right */}
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
                        <h4 className="font-semibold text-foreground">{c.name}</h4>
                        <p className="text-xs text-muted-foreground">{c.current_company} · {c.current_role} · {c.years_experience} yrs</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>€{c.salary_expectation.toLocaleString()}</p>
                        <p>{c.notice_period_weeks === 0 ? 'Immediate' : `${c.notice_period_weeks}w notice`}</p>
                      </div>
                    </div>
                    {/* Skill match bar */}
                    <div className="mt-2 mb-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Skill Match</span><span>{c.skill_match || 0}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(c.skill_match || 0) >= 70 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${c.skill_match || 0}%` }} />
                      </div>
                    </div>
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

      {/* Compare panel */}
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
