import { useMemo, useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Download, Sparkles } from 'lucide-react';
import { SALARY_BAND_WEEKLY, getOnboardingCost } from '@/lib/scoring';
import { invokeAI, ExecutiveInsights } from '@/lib/aiService';
import { useToast } from '@/hooks/use-toast';

export default function ExecutiveSummaryPage() {
  const { projectConfig, scenarios, selectedScenarioId, roster, employees, upskillCandidates, externalCandidates, shortlistedCandidates } = useStore();
  const scenario = scenarios.find(s => s.id === selectedScenarioId);

  const rosterEmps = useMemo(() => employees.filter(e => roster.includes(e.employee_id)), [employees, roster]);
  const approvedUpskill = upskillCandidates.filter(u => u.approved);
  const shortlisted = externalCandidates.filter(c => shortlistedCandidates.includes(c.id));
  const internalCount = rosterEmps.length - approvedUpskill.length;
  const totalTeam = rosterEmps.length + shortlisted.length;

  // Cost computation
  const costs = useMemo(() => {
    const upskillCost = approvedUpskill.reduce((s, u) => s + (u.totalCost || 5000) + 1500, 0);
    const reallocationCost = rosterEmps.reduce((s, e) => {
      const weekly = SALARY_BAND_WEEKLY[e.salary_band] || 1000;
      const weeks = e.project_position === 'Lead' ? 6 : e.project_position === 'Core Contributor' ? 4 : 2;
      return s + weekly * weeks;
    }, 0);
    const retentionCost = rosterEmps.filter(e => e.flight_risk?.toLowerCase() === 'high').length * 15000;
    const internalTotal = upskillCost + reallocationCost + retentionCost;

    const externalTotal = shortlisted.reduce((s, c) => {
      const fee = Math.round(c.salary_expectation * 0.18);
      const onboard = getOnboardingCost('E3');
      return s + fee + c.salary_expectation + onboard;
    }, 0);

    const total = internalTotal + externalTotal;
    const perHead = totalTeam > 0 ? Math.round(total / totalTeam) : 0;
    const savings = shortlisted.length > 0 ? Math.round((1 - internalTotal / (externalTotal || 1)) * 100) : 0;

    return { internalTotal, externalTotal, total, perHead, savings: Math.max(0, savings) };
  }, [rosterEmps, approvedUpskill, shortlisted, totalTeam]);

  // Readiness
  const dimensions = useMemo(() => {
    if (!scenario || rosterEmps.length === 0) return [];
    const allReqSkills = scenario.roles.flatMap(r => r.requiredSkills);
    const allReqCerts = scenario.roles.flatMap(r => r.requiredCerts);
    const uniqueReqSkills = [...new Set(allReqSkills)];
    const uniqueReqCerts = [...new Set(allReqCerts)];
    const coveredSkills = uniqueReqSkills.filter(s => rosterEmps.some(e => (e.technical_skills || '').toLowerCase().includes(s.toLowerCase())));
    const coveredCerts = uniqueReqCerts.filter(c => rosterEmps.some(e => (e.certifications || '').toLowerCase().includes(c.toLowerCase())));
    const avgPeer = rosterEmps.reduce((a, e) => a + (e.peer_feedback_score || 3), 0) / rosterEmps.length;
    const available = rosterEmps.filter(e => ['Support', 'Advisor', 'Contributor'].includes(e.project_position)).length;
    const highRisk = rosterEmps.filter(e => e.flight_risk?.toLowerCase() === 'high').length;

    return [
      { subject: 'Skills', score: uniqueReqSkills.length > 0 ? Math.round((coveredSkills.length / uniqueReqSkills.length) * 100) : 50 },
      { subject: 'Experience', score: Math.round(Math.min(rosterEmps.reduce((a, e) => a + e.years_at_company, 0) / rosterEmps.length / 10, 1) * 100) },
      { subject: 'Certs', score: uniqueReqCerts.length > 0 ? Math.round((coveredCerts.length / uniqueReqCerts.length) * 100) : 50 },
      { subject: 'Collaboration', score: Math.round((avgPeer / 5) * 100) },
      { subject: 'Availability', score: Math.round((available / rosterEmps.length) * 100) },
      { subject: 'Resilience', score: Math.max(0, 100 - highRisk * 15) },
    ];
  }, [scenario, rosterEmps]);

  const readiness = dimensions.length > 0 ? Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length) : 0;
  const gaugeColor = readiness >= 80 ? 'hsl(135,50%,40%)' : readiness >= 60 ? 'hsl(40,80%,48%)' : 'hsl(0,80%,62%)';

  // AI-powered insights
  const { toast } = useToast();
  const [aiInsights, setAiInsights] = useState<ExecutiveInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const fetchInsights = async () => {
    if (!projectConfig || !scenario) return;
    setLoadingInsights(true);
    try {
      const result = await invokeAI<ExecutiveInsights>('executive-insights', {
        projectConfig,
        scenarioLabel: scenario.label,
        teamComposition: {
          total: totalTeam,
          internal: Math.max(0, internalCount),
          upskilled: approvedUpskill.length,
          external: shortlisted.length,
        },
        costs: {
          total: costs.total,
          internal: costs.internalTotal,
          external: costs.externalTotal,
          perHead: costs.perHead,
        },
        readiness,
        risks: fallbackRisks,
      });
      setAiInsights(result);
    } catch (err) {
      console.error('Executive insights failed:', err);
      toast({ title: 'Insights Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoadingInsights(false);
    }
  };

  // Fallback risks from data
  const fallbackRisks = useMemo(() => {
    const r: string[] = [];
    if (!scenario) return r;
    const criticalGaps = scenario.roles.filter(role => role.gap > role.headcount * 0.5);
    if (criticalGaps.length > 0) r.push(`${criticalGaps[0].role} shortage delays critical workstreams`);
    const highRiskCount = rosterEmps.filter(e => e.flight_risk?.toLowerCase() === 'high').length;
    if (highRiskCount > 0) r.push(`${highRiskCount} flight-risk employees in critical positions`);
    if (shortlisted.some(c => c.notice_period_weeks > 8)) r.push('External candidate notice periods cause onboarding gaps');
    return r.slice(0, 3);
  }, [scenario, rosterEmps, shortlisted]);

  const risks = aiInsights?.risks.map(r => r.description) || fallbackRisks;

  const fallbackActions = useMemo(() => {
    const a: string[] = [];
    if (!scenario) return a;
    const totalGap = scenario.roles.reduce((s, r) => s + r.gap, 0);
    if (totalGap > 0) a.push(`Post ${totalGap} positions for immediate recruitment`);
    const highRisk = rosterEmps.filter(e => e.flight_risk?.toLowerCase() === 'high').length;
    if (highRisk > 0) a.push(`Initiate retention packages for ${highRisk} high flight-risk members`);
    if (approvedUpskill.length > 0) a.push(`Begin upskilling ${approvedUpskill.length} candidates to meet readiness targets`);
    return a.slice(0, 3);
  }, [scenario, rosterEmps, approvedUpskill]);

  const actions = aiInsights?.actions || fallbackActions;

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col print:h-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Executive Summary</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={fetchInsights} disabled={loadingInsights || !scenario}>
            <Sparkles size={14} className="mr-2" />{loadingInsights ? 'Generating...' : aiInsights ? 'Refresh Insights' : 'Generate AI Insights'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Download size={14} className="mr-2" />Export PDF</Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left 40% */}
        <div className="w-[40%] space-y-4 overflow-auto">
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Project</h3>
            <h4 className="font-semibold text-foreground">{projectConfig?.name || 'Not configured'}</h4>
            <div className="flex gap-2 mt-2">
              <Badge variant={projectConfig?.priority === 'Critical' ? 'badge-red' : 'badge-amber'}>{projectConfig?.priority || '—'}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div><span className="text-muted-foreground">Budget:</span> <span className="text-foreground">€{projectConfig ? `${(projectConfig.budgetMin / 1e6).toFixed(0)}-${(projectConfig.budgetMax / 1e6).toFixed(0)}M` : '—'}</span></div>
              <div><span className="text-muted-foreground">Deadline:</span> <span className="text-foreground">{projectConfig?.targetDeadline || '—'}</span></div>
            </div>
          </div>

          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Team Composition</h3>
            <p className="text-4xl font-bold text-foreground">{totalTeam}</p>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="text-center p-2 rounded bg-secondary"><p className="text-foreground font-bold text-lg">{Math.max(0, internalCount)}</p><p className="text-muted-foreground">Internal</p></div>
              <div className="text-center p-2 rounded bg-secondary"><p className="text-foreground font-bold text-lg">{approvedUpskill.length}</p><p className="text-muted-foreground">Upskilled</p></div>
              <div className="text-center p-2 rounded bg-secondary"><p className="text-foreground font-bold text-lg">{shortlisted.length}</p><p className="text-muted-foreground">External</p></div>
            </div>
          </div>

          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Selected Scenario</h3>
            <p className="text-foreground font-medium">{scenario?.label || 'None selected'}</p>
            <p className="text-xs text-muted-foreground mt-1">{scenario?.rationale || 'Select a scenario on the Dashboard'}</p>
          </div>

          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Cost Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-foreground">€{(costs.total / 1e6).toFixed(2)}M</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Internal</span><span className="text-foreground">€{(costs.internalTotal / 1000).toFixed(0)}k</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">External</span><span className="text-foreground">€{(costs.externalTotal / 1e6).toFixed(2)}M</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Per Head</span><span className="text-foreground">€{(costs.perHead / 1000).toFixed(1)}k</span></div>
              {costs.savings > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Internal Savings</span><span className="text-success font-medium">{costs.savings}%</span></div>}
            </div>
          </div>
        </div>

        {/* Right 60% */}
        <div className="flex-1 space-y-4 overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="card-surface p-4 flex flex-col items-center justify-center">
              <svg width="120" height="100" viewBox="0 0 200 160">
                <path d="M 20 140 A 80 80 0 1 1 180 140" fill="none" stroke="hsl(215,18%,14%)" strokeWidth="16" strokeLinecap="round" />
                <path d="M 20 140 A 80 80 0 1 1 180 140" fill="none" stroke={gaugeColor} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(readiness / 100 * 270 / 360) * 502} 502`} />
                <text x="100" y="120" textAnchor="middle" className="fill-foreground text-4xl font-bold">{readiness}</text>
              </svg>
              <p className="text-xs text-muted-foreground mt-1">Team Readiness</p>
            </div>
            <div className="card-surface p-4">
              {dimensions.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <RadarChart data={dimensions}>
                    <PolarGrid stroke="rgba(255,255,255,0.06)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215,12%,52%)', fontSize: 9 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="score" stroke="hsl(205,100%,45%)" fill="hsl(205,100%,35%)" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[140px] text-muted-foreground text-sm">Add team members for radar</div>
              )}
            </div>
          </div>

          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Timeline</h3>
            <div className="relative h-8 bg-secondary rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-primary/30 rounded-l-full" style={{ width: '15%' }} />
              <div className="absolute top-0 h-full bg-primary rounded-l-full" style={{ width: '15%' }}>
                <span className="absolute right-[-4px] top-[-4px] w-4 h-4 rounded-full bg-foreground border-2 border-primary" />
              </div>
              <div className="absolute top-0 h-full" style={{ left: '75%' }}>
                <div className="w-0.5 h-full bg-success" />
                <span className="absolute top-[-18px] text-[10px] text-success whitespace-nowrap -translate-x-1/2">Ready</span>
              </div>
              <div className="absolute top-0 h-full" style={{ left: '90%' }}>
                <div className="w-0.5 h-full bg-destructive" />
                <span className="absolute top-[-18px] text-[10px] text-destructive whitespace-nowrap -translate-x-1/2">Deadline</span>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Today</span>
              <span>{projectConfig?.targetDeadline || 'Q3 2026'}</span>
            </div>
          </div>

          {aiInsights?.narrative && (
            <div className="card-surface p-4">
              <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">AI Strategic Assessment</h3>
              <p className="text-sm text-foreground leading-relaxed">{aiInsights.narrative}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                <Badge variant={aiInsights.confidence === 'High' ? 'badge-green' : aiInsights.confidence === 'Medium' ? 'badge-amber' : 'badge-red'}>{aiInsights.confidence}</Badge>
              </div>
            </div>
          )}

          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Top 3 Risks</h3>
            <div className="space-y-2">
              {risks.length > 0 ? risks.map((r, i) => {
                const severity = aiInsights?.risks[i]?.severity;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant={severity === 'High' || (!severity && i === 0) ? 'badge-red' : 'badge-amber'}>{severity || (i === 0 ? 'High' : 'Med')}</Badge>
                    <span className="text-sm text-foreground">{r}</span>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground">Build your team to see risk analysis</p>
              )}
            </div>
          </div>

          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Top 3 Actions</h3>
            <div className="space-y-2">
              {actions.length > 0 ? actions.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">{i + 1}</span>
                  <span className="text-foreground">{a}</span>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Complete workflow steps for actionable recommendations</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border mt-4 pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Generated by TalentLens | {new Date().toLocaleDateString()} | {employees.length} employees | Scenario: {scenario?.label || 'None'}</span>
        <Button size="sm" onClick={() => window.print()}><Download size={14} className="mr-2" />Export PDF</Button>
      </div>
    </div>
  );
}
