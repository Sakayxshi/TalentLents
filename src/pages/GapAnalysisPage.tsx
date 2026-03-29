import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { calculateCompositeScore, getSkillOverlap, getMissingSkills, getMatchedSkills, GAP_THRESHOLDS } from '@/lib/scoring';
import { ChevronDown, ChevronUp, Plus, Sparkles, Brain, Target, AlertTriangle, CheckCircle2, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { invokeAI, GapStrategy } from '@/lib/aiService';
import { buildTrainingPath, getSkillsAfterTraining } from '@/lib/bmw-training-catalogue';

const HIRING_COST = 85_000; // EUR — cost of one external hire
const TRAINING_COST_THRESHOLD = 0.70; // training must be < 70% of hiring cost
const CRITICAL_POSITIONS = ['Lead', 'Core Contributor'];

interface UpskillCandidate {
  employee_id: string;
  name: string;
  role: string;
  overlapPct: number;
  matchedSkills: string[];
  missingSkills: string[];
  score: number;
  flight_risk: string;
  project_position: string;
  technical_skills: string;
  // Decision tree results
  trainingCost: number;
  trainingWeeks: number;
  canUpskill: boolean;
  blockedReasons: string[];
}

export default function GapAnalysisPage() {
  const { employees, scenarios, selectedScenarioId, roster, addToRoster, addUpskillCandidate, upskillCandidates, completedTrainings, completeTraining, markPageComplete, projectConfig } = useStore();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [aiStrategy, setAiStrategy] = useState<GapStrategy | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const roles = scenario?.roles || [];

  const weeksUntilDeadline = useMemo(() => {
    if (!projectConfig?.targetDeadline) return 52;
    const dl = projectConfig.targetDeadline;
    // Handle "Q1 2026" format
    const qMatch = dl.match(/Q(\d)\s+(\d{4})/);
    if (qMatch) {
      const quarter = parseInt(qMatch[1]);
      const year = parseInt(qMatch[2]);
      const month = (quarter - 1) * 3; // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
      const deadline = new Date(year, month + 3, 0); // last day of quarter
      const now = new Date();
      return Math.max(4, Math.round((deadline.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }
    const deadline = new Date(dl);
    if (isNaN(deadline.getTime())) return 52;
    const now = new Date();
    return Math.max(4, Math.round((deadline.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  }, [projectConfig]);

  const analysis = useMemo(() => {
    return roles.map(r => {
      const rostered = employees.filter(e => {
        if (!roster.includes(e.employee_id)) return false;
        const empSkills = (e.technical_skills || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
        const overlap = getSkillOverlap(empSkills, r.requiredSkills);
        return overlap >= GAP_THRESHOLDS.INTERNAL_READY;
      });

      const notRostered = employees.filter(e => !roster.includes(e.employee_id));
      const scoredPool = notRostered.map(e => {
        const empSkills = (e.technical_skills || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
        const overlap = getSkillOverlap(empSkills, r.requiredSkills);
        const missing = getMissingSkills(empSkills, r.requiredSkills);
        const matched = getMatchedSkills(empSkills, r.requiredSkills);
        const score = calculateCompositeScore(e, r.requiredSkills, r.requiredCerts);
        return { ...e, overlap, overlapPct: Math.round(overlap * 100), missingSkills: missing, matchedSkills: matched, score: score.total };
      });

      // ≥80% → Internal Ready (assign directly)
      const internalReady = scoredPool
        .filter(e => e.overlap >= GAP_THRESHOLDS.INTERNAL_READY)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // 60–79% → check 4 upskilling conditions
      const upskillCandidates: UpskillCandidate[] = scoredPool
        .filter(e => e.overlap >= GAP_THRESHOLDS.UPSKILLABLE && e.overlap < GAP_THRESHOLDS.INTERNAL_READY)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 5)
        .map(e => {
          const { totalCost, totalWeeks } = buildTrainingPath(e.missingSkills);

          const blockedReasons: string[] = [];

          // Condition 1: training cost < 70% of hiring cost
          if (totalCost >= HIRING_COST * TRAINING_COST_THRESHOLD) {
            blockedReasons.push(`Training cost €${totalCost.toLocaleString()} ≥ 70% of hire cost`);
          }

          // Condition 2: training fits within deadline
          if (totalWeeks > weeksUntilDeadline) {
            blockedReasons.push(`${totalWeeks}w training exceeds ${weeksUntilDeadline}w deadline`);
          }

          // Condition 3: flight risk not high
          if (e.flight_risk?.toLowerCase() === 'high') {
            blockedReasons.push('High flight risk');
          }

          // Condition 4: not on critical project
          if (CRITICAL_POSITIONS.includes(e.project_position)) {
            blockedReasons.push(`Critical project role: ${e.project_position}`);
          }

          return {
            ...e,
            trainingCost: totalCost,
            trainingWeeks: totalWeeks,
            canUpskill: blockedReasons.length === 0,
            blockedReasons,
          };
        });

      const trainable = upskillCandidates.filter(e => e.canUpskill);
      const blocked = upskillCandidates.filter(e => !e.canUpskill);

      const filled = rostered.length;
      const gap = Math.max(0, r.headcount - filled);
      const canFillInternal = Math.min(internalReady.length, gap);
      const canFillTraining = Math.min(trainable.length, Math.max(0, gap - canFillInternal));
      const externalNeeded = Math.max(0, gap - canFillInternal - canFillTraining);

      const rosteredCerts = rostered.flatMap(e => (e.certifications || '').split(/[,;]/).map(c => c.trim().toLowerCase()));
      const missingCerts = r.requiredCerts.filter(c => !rosteredCerts.some(rc => rc.includes(c.toLowerCase())));

      const fillRate = (filled + canFillInternal) / Math.max(r.headcount, 1);
      const status = fillRate >= 1 ? 'staffed' : fillRate >= 0.5 ? 'partial' : 'critical';

      let recommendation: string;
      if (gap === 0) recommendation = 'internal';
      else if (externalNeeded === 0 && canFillTraining > 0) recommendation = 'upskill';
      else if (externalNeeded === 0) recommendation = 'internal';
      else if (canFillTraining > 0) recommendation = 'mixed';
      else recommendation = 'hire_external';

      return {
        ...r,
        filled,
        gap,
        rostered,
        internalReady,
        upskillCandidates,
        trainable,
        blocked,
        canFillInternal,
        canFillTraining,
        externalNeeded,
        missingCerts,
        status,
        recommendation,
      };
    });
  }, [roles, employees, roster, weeksUntilDeadline]);

  const fullyStaffed = analysis.filter(r => r.gap === 0).length;
  const partial = analysis.filter(r => r.gap > 0 && (r.filled > 0 || r.trainable.length > 0)).length;
  const critical = analysis.filter(r => r.gap > 0 && r.filled === 0 && r.trainable.length === 0 && r.internalReady.length === 0).length;

  const allMissingCerts = useMemo(() => {
    const counts: Record<string, number> = {};
    analysis.forEach(r => { r.missingCerts.forEach(c => { counts[c] = (counts[c] || 0) + 1; }); });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [analysis]);

  const handleAiStrategy = async () => {
    if (!scenario || !projectConfig) return;
    setLoadingAi(true);
    try {
      const result = await invokeAI<GapStrategy>('gap-strategy', {
        projectName: projectConfig.name,
        roles: analysis.map(r => ({
          role: r.role, headcount: r.headcount, filled: r.filled, gap: r.gap,
          trainable: r.trainable.length, blocked: r.blocked.length,
          externalNeeded: r.externalNeeded, recommendation: r.recommendation,
          missingSkills: r.requiredSkills.slice(0, 5), missingCerts: r.missingCerts,
        })),
        missingCerts: allMissingCerts.map(([cert, count]) => ({ cert, count })),
        totalEmployees: employees.length,
        rosterSize: roster.length,
      });
      setAiStrategy(result);
      toast({ title: 'AI Gap Strategy Complete', description: `Staffing Health: ${result.staffingHealth}` });
    } catch (err) {
      toast({ title: 'Analysis Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoadingAi(false);
    }
  };

  const healthColors: Record<string, string> = { 'Strong': 'badge-green', 'Adequate': 'badge-blue', 'Concerning': 'badge-amber', 'Critical': 'badge-red' };
  const approachColors: Record<string, string> = { 'Hire Externally': 'badge-coral', 'Upskill Internal': 'badge-green', 'Contract/Temp': 'badge-amber', 'Mixed Approach': 'badge-blue' };
  const availColors: Record<string, string> = { 'High': 'badge-green', 'Medium': 'badge-blue', 'Low': 'badge-amber', 'Scarce': 'badge-red' };

  if (!scenario) {
    return (<div><PageHeader title="Gap Analysis" /><div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario on the Dashboard first.</p></div></div>);
  }

  return (
    <div>
      <PageHeader title="Gap Analysis & Training" subtitle="Identify gaps, upskill internal, hire external">
        <Button size="sm" onClick={handleAiStrategy} disabled={loadingAi}>
          <Sparkles size={14} className="mr-2" />{loadingAi ? 'Analyzing...' : aiStrategy ? 'Refresh AI Strategy' : 'AI Gap Strategy'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard label="Fully Staffed" value={fullyStaffed} className="border-l-4 border-l-success" />
        <MetricCard label="Partially Filled" value={partial} className="border-l-4 border-l-warning" />
        <MetricCard label="Critical Gaps" value={critical} className="border-l-4 border-l-destructive" />
      </div>

      {/* AI Gap Strategy */}
      {aiStrategy && (
        <div className="card-surface p-5 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">AI Gap Resolution Strategy</h3>
            <Badge variant={healthColors[aiStrategy.staffingHealth]}>{aiStrategy.staffingHealth}</Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{aiStrategy.narrative}</p>
          <div className="bg-secondary rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-primary" />
              <p className="text-xs font-medium text-foreground">Critical Path: {aiStrategy.criticalPath}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {aiStrategy.roleStrategies.sort((a, b) => a.priority - b.priority).map((rs, i) => (
              <div key={i} className="bg-secondary rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground">#{rs.priority}</span>
                  <span className="text-sm font-medium text-foreground">{rs.role}</span>
                </div>
                <div className="flex gap-1 mb-2">
                  <Badge variant={approachColors[rs.approach]}>{rs.approach}</Badge>
                  <Badge variant={availColors[rs.marketAvailability]}>Market: {rs.marketAvailability}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{rs.rationale}</p>
                <p className="text-xs text-primary mt-1">Est. time to fill: {rs.timeToFill}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-surface p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">Staffing Overview</h3>
        <div className="space-y-3">
          {analysis.map(r => {
            const filledPct = (r.filled / Math.max(r.headcount, 1)) * 100;
            const externalPct = (r.externalNeeded / Math.max(r.headcount, 1)) * 100;
            return (
              <div key={r.role}>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{r.role}</span><span className="text-muted-foreground">{r.filled}/{r.headcount}</span></div>
                <div className="h-4 bg-muted rounded-full overflow-hidden flex relative">
                  <div className="bg-primary h-full" style={{ width: `${filledPct}%` }} />
                  {r.externalNeeded > 0 && <div className="bg-destructive h-full" style={{ width: `${externalPct}%` }} />}
                  <div className="absolute right-0 top-0 h-full w-0.5 bg-foreground/30" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded" /> On Roster</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-destructive rounded" /> External Hire</span>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {analysis.map(r => (
          <div key={r.role} className="card-surface overflow-hidden">
            <button onClick={() => setExpanded(expanded === r.role ? null : r.role)} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-foreground">{r.role}</h4>
                <Badge variant={r.status === 'staffed' ? 'badge-green' : r.status === 'partial' ? 'badge-amber' : 'badge-red'}>
                  {r.status === 'staffed' ? 'Staffed' : `Gap: ${r.gap}`}
                </Badge>
                {r.recommendation === 'upskill' && <Badge variant="badge-blue">Upskill</Badge>}
                {r.recommendation === 'hire_external' && <Badge variant="badge-coral">Hire External</Badge>}
                {r.recommendation === 'mixed' && <Badge variant="badge-amber">Mixed</Badge>}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Required: {r.headcount}</span><span>Filled: {r.filled}</span>
                {expanded === r.role ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            {expanded === r.role && (
              <div className="border-t border-border p-4 space-y-4 animate-fade-in-up">
                <div>
                  <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Assigned ({r.rostered.length})</h5>
                  {r.rostered.length === 0 ? <p className="text-sm text-muted-foreground">None assigned yet</p> : (
                    <div className="space-y-1">{r.rostered.map(e => (<div key={e.employee_id} className="flex justify-between text-sm px-2 py-1 rounded bg-secondary/50"><span className="text-foreground">{e.name}</span><span className="text-muted-foreground">{calculateCompositeScore(e, r.requiredSkills, r.requiredCerts).total} pts</span></div>))}</div>
                  )}
                </div>
                {r.internalReady.length > 0 && (
                  <div>
                    <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Internal Ready <span className="text-success">(≥80% match)</span>
                    </h5>
                    <div className="space-y-2">
                      {r.internalReady.map(e => (
                        <div key={e.employee_id} className="flex items-center justify-between text-sm px-2 py-2 rounded bg-success/5 border border-success/20">
                          <div className="flex-1">
                            <span className="text-foreground font-medium">{e.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">({e.role})</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {e.matchedSkills.map(s => <span key={s} className="px-1.5 py-0 text-[10px] rounded badge-green">{s}</span>)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-success font-medium">{e.overlapPct}%</span>
                            <button onClick={() => { addToRoster(e.employee_id); markPageComplete(4); toast({ title: 'Added to Roster', description: `${e.name} is ready` }); }} className="text-primary hover:bg-primary/10 p-1 rounded"><Plus size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r.trainable.length > 0 && (
                  <div>
                    <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      <GraduationCap size={12} className="inline mr-1" />Training @ BMW <span className="text-warning">(60–79% · all 4 conditions met)</span>
                    </h5>
                    <div className="space-y-3">
                      {r.trainable.map(e => {
                        const isApproved = upskillCandidates.some(u => u.employeeId === e.employee_id && u.approved);
                        const isCompleted = completedTrainings.includes(e.employee_id);
                        const path = buildTrainingPath(e.missingSkills);
                        return (
                          <div key={e.employee_id} className={`text-sm px-3 py-3 rounded border ${isCompleted ? 'bg-success/5 border-success/20 opacity-70' : 'bg-warning/5 border-warning/20'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-foreground font-medium">{e.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">— {e.role}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-warning font-medium">{e.overlapPct}% match</span>
                                <span className="text-muted-foreground">· {e.missingSkills.length} skills missing · {e.trainingWeeks}w · €{e.trainingCost.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {e.matchedSkills.map(s => <span key={s} className="px-1.5 py-0 text-[10px] rounded badge-green">{s}</span>)}
                              {e.missingSkills.map(s => <span key={s} className="px-1.5 py-0 text-[10px] rounded badge-amber">{s}</span>)}
                            </div>
                            {/* Inline training path */}
                            {path.courses.length > 0 && (
                              <div className="mt-2 pl-2 border-l-2 border-warning/30 space-y-1">
                                {path.courses.map((c, i) => (
                                  <div key={c.id} className="flex items-center gap-2 text-[11px]">
                                    <span className="w-4 h-4 rounded-full bg-warning/20 text-warning flex items-center justify-center text-[9px] font-bold shrink-0">{i + 1}</span>
                                    <span className="text-foreground">{c.name}</span>
                                    <span className="text-muted-foreground ml-auto">{c.duration_weeks}w · €{c.cost_eur.toLocaleString()} · {c.delivery}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Action buttons */}
                            <div className="flex gap-2 mt-2">
                              {isCompleted ? (
                                <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 size={12} />Training Complete</span>
                              ) : isApproved ? (
                                <>
                                  <Badge variant="badge-blue">Approved</Badge>
                                  <Button size="sm" variant="outline" className="h-6 text-xs text-success border-success/40" onClick={() => {
                                    const emp = employees.find(e2 => e2.employee_id === e.employee_id);
                                    if (!emp) return;
                                    const newSkills = getSkillsAfterTraining(emp.technical_skills, path.courses);
                                    completeTraining(e.employee_id, newSkills);
                                    toast({ title: 'Training Complete', description: `${e.name}'s skills updated — gap recalculated` });
                                  }}>
                                    <CheckCircle2 size={11} className="mr-1" />Mark Complete
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => {
                                  addToRoster(e.employee_id);
                                  addUpskillCandidate({
                                    employeeId: e.employee_id,
                                    targetRole: r.role,
                                    approved: true,
                                    trainingPath: path.courses.map(c => ({ course: c.name, duration: `${c.duration_weeks}w`, cost: c.cost_eur, method: c.delivery, coversSkills: c.skillsGranted })),
                                    totalCost: path.totalCost,
                                    totalWeeks: path.totalWeeks,
                                  });
                                  markPageComplete(4);
                                  toast({ title: 'Approved for Training', description: `${e.name} — ${path.courses.length} courses, ${path.totalWeeks}w` });
                                }}>
                                  <Plus size={11} className="mr-1" />Approve Upskilling
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {r.blocked.length > 0 && (
                  <div>
                    <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      💼 → Job Posting <span className="text-destructive">(60–79% · blocked from training)</span>
                    </h5>
                    <div className="space-y-2">
                      {r.blocked.map(e => (
                        <div key={e.employee_id} className="flex items-center justify-between text-sm px-2 py-2 rounded bg-destructive/5 border border-destructive/20">
                          <div className="flex-1">
                            <span className="text-foreground font-medium">{e.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">({e.role}) · {e.overlapPct}% match</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {e.blockedReasons.map(reason => (
                                <span key={reason} className="flex items-center gap-1 px-1.5 py-0 text-[10px] rounded badge-red">
                                  <AlertTriangle size={8} />{reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r.externalNeeded > 0 && (
                  <div>
                    <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">External Hire Needed</h5>
                    <p className="text-sm text-muted-foreground">{r.externalNeeded} positions · Est. €{(r.externalNeeded * 85000).toLocaleString()} per hire</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => toast({ title: 'Navigate to Job Postings to generate descriptions' })}>Generate Job Posting</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Upskilling Summary */}
      {analysis.some(r => r.trainable.length > 0) && (
        <div className="card-surface p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap size={18} className="text-warning" />
            <h3 className="font-semibold text-foreground">Upskilling Summary</h3>
          </div>
          {(() => {
            const allTrainable = analysis.flatMap(r => r.trainable);
            const approved = allTrainable.filter(e => upskillCandidates.some(u => u.employeeId === e.employee_id && u.approved));
            const completed = allTrainable.filter(e => completedTrainings.includes(e.employee_id));
            const totalCost = allTrainable.reduce((s, e) => s + e.trainingCost, 0);
            const avgWeeks = allTrainable.length > 0 ? Math.round(allTrainable.reduce((s, e) => s + e.trainingWeeks, 0) / allTrainable.length) : 0;
            const savingsVsExternal = allTrainable.length * HIRING_COST - totalCost;
            return (
              <div className="grid grid-cols-5 gap-3 text-center text-sm">
                <div className="p-2 rounded bg-secondary"><p className="text-foreground font-bold text-lg">{allTrainable.length}</p><p className="text-xs text-muted-foreground">Candidates</p></div>
                <div className="p-2 rounded bg-secondary"><p className="text-foreground font-bold text-lg">{approved.length}</p><p className="text-xs text-muted-foreground">Approved</p></div>
                <div className="p-2 rounded bg-secondary"><p className="text-foreground font-bold text-lg">{completed.length}</p><p className="text-xs text-success">Completed</p></div>
                <div className="p-2 rounded bg-secondary"><p className="text-foreground font-bold text-lg">{avgWeeks}w</p><p className="text-xs text-muted-foreground">Avg Time</p></div>
                <div className="p-2 rounded bg-secondary"><p className="text-success font-bold text-lg">€{(savingsVsExternal / 1000).toFixed(0)}k</p><p className="text-xs text-muted-foreground">Saved vs Hire</p></div>
              </div>
            );
          })()}
        </div>
      )}

      {allMissingCerts.length > 0 && (
        <div className="card-surface p-5">
          <h3 className="font-semibold text-foreground mb-3">Missing Qualifications</h3>
          <div className="flex flex-wrap gap-2">
            {allMissingCerts.map(([cert, count]) => (
              <div key={cert} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10">
                <span className="text-sm text-destructive">{cert}</span><span className="text-xs text-destructive/70">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
