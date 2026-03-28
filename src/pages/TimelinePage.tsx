import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { getRecruitingWeeks } from '@/lib/scoring';
import { Button } from '@/components/ui/button';
import { Sparkles, Brain, Zap, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { invokeAI, TimelineRisks } from '@/lib/aiService';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TimelinePage() {
  const { projectConfig, employees, roster, upskillCandidates, externalCandidates, shortlistedCandidates, scenarios, selectedScenarioId } = useStore();
  const { toast } = useToast();
  const [aiTimeline, setAiTimeline] = useState<TimelineRisks | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const scenario = scenarios.find(s => s.id === selectedScenarioId);

  const { timelineData, phases, readyByMonth, dayOneCount, bottleneck } = useMemo(() => {
    if (!scenario) return { timelineData: [], phases: [], readyByMonth: 0, dayOneCount: 0, bottleneck: 'N/A' };

    const entries: { name: string; lane: 'internal' | 'upskill' | 'external'; start: number; duration: number; color: string }[] = [];
    let maxEnd = 0;
    const rosterEmps = employees.filter(e => roster.includes(e.employee_id));
    const isUpskilling = (id: string) => upskillCandidates.some(u => u.employeeId === id);
    let immediateCount = 0;

    rosterEmps.forEach(e => {
      if (isUpskilling(e.employee_id)) return;
      let startMonth = 0, handoverDuration = 0;
      if (e.project_position === 'Lead' || e.project_position === 'Core Contributor') { startMonth = 1; handoverDuration = 1; }
      else if (e.project_position === 'Contributor') { startMonth = 0.5; handoverDuration = 0.5; }
      else { immediateCount++; }
      const activeDuration = 6;
      if (handoverDuration > 0) entries.push({ name: `${e.name} (handover)`, lane: 'internal', start: startMonth, duration: handoverDuration, color: 'bg-primary/40' });
      entries.push({ name: `${e.name}`, lane: 'internal', start: startMonth + handoverDuration, duration: activeDuration, color: 'bg-primary' });
      maxEnd = Math.max(maxEnd, startMonth + handoverDuration + activeDuration);
    });

    upskillCandidates.filter(u => u.approved).forEach(u => {
      const emp = employees.find(e => e.employee_id === u.employeeId);
      const trainingMonths = Math.ceil((u.totalWeeks || 8) / 4);
      entries.push({ name: `${emp?.name || 'Unknown'} (training)`, lane: 'upskill', start: 0, duration: trainingMonths, color: 'bg-warning' });
      entries.push({ name: `${emp?.name || 'Unknown'} (active)`, lane: 'upskill', start: trainingMonths, duration: 6, color: 'bg-success' });
      maxEnd = Math.max(maxEnd, trainingMonths + 6);
    });

    const shortlisted = externalCandidates.filter(c => shortlistedCandidates.includes(c.id));
    shortlisted.forEach(c => {
      const recruitMonths = Math.ceil(getRecruitingWeeks(c.current_role) / 4);
      const noticeMonths = Math.ceil(c.notice_period_weeks / 4);
      entries.push({ name: `Recruit: ${c.name}`, lane: 'external', start: 0, duration: recruitMonths, color: 'bg-muted-foreground/30' });
      entries.push({ name: `Notice: ${c.name}`, lane: 'external', start: recruitMonths, duration: noticeMonths, color: 'bg-score-amber/40' });
      entries.push({ name: `${c.name} (active)`, lane: 'external', start: recruitMonths + noticeMonths + 1, duration: 4, color: 'bg-success' });
      maxEnd = Math.max(maxEnd, recruitMonths + noticeMonths + 5);
    });

    if (entries.length === 0) entries.push({ name: 'No team configured', lane: 'internal', start: 0, duration: 1, color: 'bg-muted' });

    const totalPeople = rosterEmps.length + upskillCandidates.filter(u => u.approved).length + shortlisted.length;
    const q1People = immediateCount + rosterEmps.filter(e => e.project_position === 'Contributor' && !isUpskilling(e.employee_id)).length;
    const q2People = q1People + rosterEmps.filter(e => ['Core Contributor', 'Lead'].includes(e.project_position) && !isUpskilling(e.employee_id)).length;
    const q3People = q2People + upskillCandidates.filter(u => u.approved).length;
    const q4People = totalPeople;
    const phaseData = [
      { label: 'Q1 2026', title: 'Foundation', desc: `Internal team assembled. ${q1People} people active.`, people: q1People },
      { label: 'Q2 2026', title: 'Scaling', desc: `Senior handovers complete. Upskilling underway. ${q2People} people.`, people: q2People },
      { label: 'Q3 2026', title: 'Full Capacity', desc: `External hires onboarded. Upskill cohort certified. ${q3People} people.`, people: q3People },
      { label: 'Q4 2026', title: 'Optimization', desc: `Full team of ${q4People}. Performance tuning.`, people: q4People },
    ];

    const longestExternal = shortlisted.length > 0 ? Math.max(...shortlisted.map(c => Math.ceil(getRecruitingWeeks(c.current_role) / 4) + Math.ceil(c.notice_period_weeks / 4) + 1)) : 0;
    const longestUpskill = upskillCandidates.filter(u => u.approved).length > 0 ? Math.max(...upskillCandidates.filter(u => u.approved).map(u => Math.ceil((u.totalWeeks || 8) / 4))) : 0;

    return { timelineData: entries, phases: phaseData, readyByMonth: Math.max(longestExternal, longestUpskill, 3), dayOneCount: q1People, bottleneck: longestExternal > longestUpskill ? 'External Recruiting' : 'Upskilling Pipeline' };
  }, [scenario, employees, roster, upskillCandidates, externalCandidates, shortlistedCandidates]);

  const deadlineMonth = useMemo(() => {
    if (!projectConfig?.targetDeadline) return 8;
    const q = projectConfig.targetDeadline.split(' ')[0];
    return { Q1: 2, Q2: 5, Q3: 8, Q4: 11 }[q] || 8;
  }, [projectConfig]);

  const readyDate = months[Math.min(readyByMonth, 11)];
  const readyYear = readyByMonth > 11 ? 2027 : 2026;
  const isOnTrack = readyByMonth <= deadlineMonth;

  const rosterEmps = employees.filter(e => roster.includes(e.employee_id));
  const shortlisted = externalCandidates.filter(c => shortlistedCandidates.includes(c.id));
  const approvedUpskill = upskillCandidates.filter(u => u.approved);

  const handleAiAnalyze = async () => {
    if (!scenario || !projectConfig) return;
    setLoadingAi(true);
    try {
      const result = await invokeAI<TimelineRisks>('timeline-risks', {
        projectName: projectConfig.name,
        deadline: projectConfig.targetDeadline,
        teamSize: rosterEmps.length + shortlisted.length + approvedUpskill.length,
        phases,
        bottleneck,
        readyByMonth,
        dayOneCount,
        rosterDetails: {
          count: rosterEmps.length,
          leadCount: rosterEmps.filter(e => e.project_position === 'Lead').length,
          handoverCount: rosterEmps.filter(e => ['Lead', 'Core Contributor'].includes(e.project_position)).length,
        },
        externalDetails: {
          count: shortlisted.length,
          avgNotice: shortlisted.length > 0 ? Math.round(shortlisted.reduce((s, c) => s + c.notice_period_weeks, 0) / shortlisted.length) : 0,
        },
        upskillDetails: {
          count: approvedUpskill.length,
          avgWeeks: approvedUpskill.length > 0 ? Math.round(approvedUpskill.reduce((s, u) => s + (u.totalWeeks || 8), 0) / approvedUpskill.length) : 0,
        },
      });
      setAiTimeline(result);
      toast({ title: 'AI Timeline Analysis Complete', description: `Status: ${result.timelineHealth}` });
    } catch (err) {
      toast({ title: 'Analysis Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoadingAi(false);
    }
  };

  const healthColors: Record<string, string> = { 'On Track': 'badge-green', 'At Risk': 'badge-amber', 'Critical Delay': 'badge-red' };
  const sevColors: Record<string, string> = { 'High': 'badge-red', 'Medium': 'badge-amber', 'Low': 'badge-green' };

  if (!scenario) {
    return (<div><PageHeader title="Timeline" /><div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario first.</p></div></div>);
  }

  return (
    <div>
      <PageHeader title="Timeline" subtitle="Project staffing timeline and milestones">
        <Button size="sm" onClick={handleAiAnalyze} disabled={loadingAi}>
          <Sparkles size={14} className="mr-2" />{loadingAi ? 'Analyzing...' : aiTimeline ? 'Refresh AI Analysis' : 'AI Timeline Analysis'}
        </Button>
      </PageHeader>

      <div className="card-surface p-6 mb-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Team Ready By</p>
        <p className={`text-3xl font-bold ${isOnTrack ? 'text-success' : 'text-destructive'}`}>{readyDate} {readyYear}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Target: {projectConfig?.targetDeadline || 'Not set'} {isOnTrack ? '✓ On track' : '⚠ At risk'}
        </p>
        {aiTimeline && <Badge variant={healthColors[aiTimeline.timelineHealth]}>{aiTimeline.timelineHealth}</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard label="Months to Full Capacity" value={readyByMonth} />
        <MetricCard label="People on Day One" value={dayOneCount} />
        <MetricCard label="Critical Path" value={bottleneck} subtitle="Bottleneck" />
      </div>

      {/* AI Timeline Insights */}
      {aiTimeline && (
        <div className="card-surface p-5 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">AI Timeline Assessment</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{aiTimeline.narrative}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline Risks</p>
              <div className="space-y-2">
                {aiTimeline.risks.map((r, i) => (
                  <div key={i} className="bg-secondary rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={13} />
                      <Badge variant={sevColors[r.severity]}>{r.severity}</Badge>
                      <span className="text-xs text-muted-foreground">{r.affectedPhase}</span>
                    </div>
                    <p className="text-xs text-foreground">{r.description}</p>
                    <p className="text-xs text-primary mt-1">Mitigation: {r.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Acceleration Opportunities</p>
              <div className="space-y-2">
                {aiTimeline.accelerationOpportunities.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 bg-secondary rounded-lg p-3">
                    <Zap size={14} className="text-success mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gantt chart */}
      <div className="card-surface p-5 mb-6 overflow-x-auto">
        <h3 className="font-semibold text-foreground mb-4">Gantt Chart</h3>
        <div className="min-w-[800px]">
          <div className="flex mb-2 ml-32">
            {months.map((m, i) => (
              <div key={m} className="flex-1 text-xs text-muted-foreground text-center relative">
                {m}
                {i === deadlineMonth && <div className="absolute top-6 left-1/2 w-0.5 h-[120px] bg-destructive/50 border-l border-dashed border-destructive" />}
              </div>
            ))}
          </div>
          {(['internal', 'upskill', 'external'] as const).map(lane => {
            const laneItems = timelineData.filter(t => t.lane === lane);
            return (
              <div key={lane} className="flex items-center mb-1">
                <div className="w-32 text-xs text-muted-foreground capitalize pr-2 shrink-0">{lane === 'upskill' ? 'Upskilling' : lane === 'internal' ? 'Internal' : 'External'}</div>
                <div className="flex-1 relative h-8">
                  {laneItems.slice(0, 6).map((t, i) => (
                    <div key={i} className={`absolute h-6 top-1 rounded ${t.color} flex items-center px-2`} style={{ left: `${(t.start / 12) * 100}%`, width: `${Math.max(0.5, t.duration) / 12 * 100}%` }} title={t.name}>
                      <span className="text-[10px] text-foreground truncate">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {phases.map(p => (
          <div key={p.label} className="card-surface p-4">
            <Badge variant="badge-blue">{p.label}</Badge>
            <h4 className="font-semibold text-foreground mt-2">{p.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
            <p className="text-lg font-bold text-foreground mt-2">{p.people} <span className="text-xs text-muted-foreground font-normal">people</span></p>
          </div>
        ))}
      </div>

      <div className="card-surface p-5">
        <h3 className="font-semibold text-foreground mb-3">Risk Alerts by Phase</h3>
        <div className="space-y-2">
          {scenario.roles.filter(r => r.gap > r.headcount * 0.3).slice(0, 2).map((r, i) => (
            <div key={r.role} className="flex items-center gap-3 text-sm"><Badge variant="badge-red">Month {i + 2}</Badge><span className="text-foreground">{r.role} shortage ({r.gap} unfilled) may delay critical workstreams</span></div>
          ))}
          {externalCandidates.filter(c => shortlistedCandidates.includes(c.id) && c.notice_period_weeks > 8).length > 0 && (
            <div className="flex items-center gap-3 text-sm"><Badge variant="badge-amber">Month 4</Badge><span className="text-foreground">External candidate notice periods could cause onboarding gaps</span></div>
          )}
          {approvedUpskill.length > 0 && (
            <div className="flex items-center gap-3 text-sm"><Badge variant="badge-green">Month {readyByMonth}</Badge><span className="text-foreground">Upskill cohort completes training — additional capacity unlocked</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
