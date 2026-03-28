import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, Info, Sparkles, Brain, Award } from 'lucide-react';
import { calculateCompositeScore, getScoreColor, getSkillOverlap } from '@/lib/scoring';
import { useToast } from '@/hooks/use-toast';
import { invokeAI, TeamRecommendations } from '@/lib/aiService';

const warningIcons = { critical: AlertTriangle, warning: Info, positive: CheckCircle2 };
const warningColors = { critical: 'border-l-destructive bg-destructive/5', warning: 'border-l-warning bg-warning/5', positive: 'border-l-success bg-success/5' };
const sourceColors: Record<string, string> = { Internal: 'badge-blue', Upskilled: 'badge-teal', External: 'badge-coral' };

export default function TeamEfficiencyPage() {
  const navigate = useNavigate();
  const { employees, roster, upskillCandidates, externalCandidates, shortlistedCandidates, scenarios, selectedScenarioId, markPageComplete, projectConfig } = useStore();
  const { toast } = useToast();
  const [aiRecs, setAiRecs] = useState<TeamRecommendations | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const scenario = scenarios.find(s => s.id === selectedScenarioId);

  const dimensions = useMemo(() => {
    if (!scenario) return [];
    const allReqSkills = scenario.roles.flatMap(r => r.requiredSkills);
    const allReqCerts = scenario.roles.flatMap(r => r.requiredCerts);
    const rosterEmps = employees.filter(e => roster.includes(e.employee_id));

    if (rosterEmps.length === 0) {
      return [
        { name: 'Skill Coverage', score: 0, explanation: 'No team members on roster', data: 'Add employees to roster' },
        { name: 'Experience Depth', score: 0, explanation: 'No data', data: '—' },
        { name: 'Certification Coverage', score: 0, explanation: 'No data', data: '—' },
        { name: 'Collaboration', score: 0, explanation: 'No data', data: '—' },
        { name: 'Availability', score: 0, explanation: 'No data', data: '—' },
        { name: 'Risk Resilience', score: 0, explanation: 'No data', data: '—' },
      ];
    }

    const uniqueReqSkills = [...new Set(allReqSkills)];
    const coveredSkills = uniqueReqSkills.filter(s => rosterEmps.some(e => (e.technical_skills || '').toLowerCase().includes(s.toLowerCase())));
    const skillCoverage = uniqueReqSkills.length > 0 ? Math.round((coveredSkills.length / uniqueReqSkills.length) * 100) : 50;
    const avgYears = rosterEmps.reduce((a, e) => a + e.years_at_company, 0) / rosterEmps.length;
    const experienceDepth = Math.round(Math.min(avgYears / 10, 1) * 100);
    const uniqueReqCerts = [...new Set(allReqCerts)];
    const coveredCerts = uniqueReqCerts.filter(c => rosterEmps.some(e => (e.certifications || '').toLowerCase().includes(c.toLowerCase())));
    const certCoverage = uniqueReqCerts.length > 0 ? Math.round((coveredCerts.length / uniqueReqCerts.length) * 100) : 50;
    const avgPeer = rosterEmps.reduce((a, e) => a + (e.peer_feedback_score || 3), 0) / rosterEmps.length;
    const collaboration = Math.round((avgPeer / 5) * 100);
    const available = rosterEmps.filter(e => ['Support', 'Advisor', 'Contributor'].includes(e.project_position)).length;
    const availability = Math.round((available / rosterEmps.length) * 100);
    const highRisk = rosterEmps.filter(e => e.flight_risk?.toLowerCase() === 'high').length;
    const skillHolders: Record<string, number> = {};
    uniqueReqSkills.forEach(s => { if (rosterEmps.filter(e => (e.technical_skills || '').toLowerCase().includes(s.toLowerCase())).length === 1) skillHolders[s] = 1; });
    const spof = Object.keys(skillHolders).length;
    const riskResilience = Math.max(0, 100 - highRisk * 10 - spof * 15);

    return [
      { name: 'Skill Coverage', score: skillCoverage, explanation: `Team covers ${skillCoverage}% of required technical competencies`, data: `${coveredSkills.length}/${uniqueReqSkills.length} skills covered` },
      { name: 'Experience Depth', score: experienceDepth, explanation: `Average ${avgYears.toFixed(1)} years tenure`, data: `${rosterEmps.length} team members` },
      { name: 'Certification Coverage', score: certCoverage, explanation: `${coveredCerts.length} of ${uniqueReqCerts.length} required certifications present`, data: `${coveredCerts.length}/${uniqueReqCerts.length} certs covered` },
      { name: 'Collaboration', score: collaboration, explanation: `Average peer feedback: ${avgPeer.toFixed(1)}/5`, data: `Avg peer score: ${avgPeer.toFixed(1)}/5` },
      { name: 'Availability', score: availability, explanation: `${available} of ${rosterEmps.length} members available within timeline`, data: `${Math.round(availability)}% available soon` },
      { name: 'Risk Resilience', score: riskResilience, explanation: `${highRisk} high-risk, ${spof} single-point-of-failure skills`, data: `${highRisk} high-risk members` },
    ];
  }, [scenario, employees, roster]);

  const overallScore = dimensions.length > 0 ? Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length) : 0;
  const radarData = dimensions.map(d => ({ subject: d.name, score: d.score, ideal: 85 }));

  const warnings = useMemo(() => {
    if (!scenario) return [];
    const warns: { type: 'critical' | 'warning' | 'positive'; text: string; link: string }[] = [];
    const rosterEmps = employees.filter(e => roster.includes(e.employee_id));
    const highRisk = rosterEmps.filter(e => e.flight_risk?.toLowerCase() === 'high');
    scenario.roles.forEach(r => {
      const filled = rosterEmps.filter(e => {
        const empSkills = (e.technical_skills || '').toLowerCase();
        return r.requiredSkills.some(s => empSkills.includes(s.toLowerCase()));
      }).length;
      if (filled < r.headcount * 0.5) warns.push({ type: 'critical', text: `${r.role} has only ${Math.round((filled / Math.max(r.headcount, 1)) * 100)}% coverage — ${r.headcount - filled} positions remain unfilled`, link: '/gap-analysis' });
    });
    if (highRisk.length > 0) warns.push({ type: 'warning', text: `${highRisk.length} high flight-risk employees on roster — retention actions recommended`, link: '/workforce' });
    const wellStaffed = scenario.roles.filter(r => {
      const filled = rosterEmps.filter(e => e.role?.toLowerCase().includes(r.role.split(' ')[0].toLowerCase())).length;
      return filled >= r.headcount;
    });
    if (wellStaffed.length > 0) warns.push({ type: 'positive', text: `${wellStaffed.map(r => r.role).join(', ')} fully staffed with strong coverage`, link: '/workforce' });
    return warns.slice(0, 5);
  }, [scenario, employees, roster]);

  const rosterMembers = useMemo(() => {
    const rosterEmps = employees.filter(e => roster.includes(e.employee_id)).map(e => {
      const isUpskilling = upskillCandidates.some(u => u.employeeId === e.employee_id);
      const score = calculateCompositeScore(e, scenario?.roles.flatMap(r => r.requiredSkills) || [], scenario?.roles.flatMap(r => r.requiredCerts) || []);
      return { name: e.name, role: e.role, source: isUpskilling ? 'Upskilled' : 'Internal', status: isUpskilling ? 'Training' : 'Active', score: score.total, risk: e.flight_risk?.toLowerCase() === 'high' };
    });
    const extMembers = externalCandidates.filter(c => shortlistedCandidates.includes(c.id)).map(c => ({
      name: c.name, role: c.current_role, source: 'External', status: c.notice_period_weeks > 0 ? 'Notice Period' : 'Active', score: c.composite_score || 0, risk: false,
    }));
    return [...rosterEmps, ...extMembers];
  }, [employees, roster, upskillCandidates, externalCandidates, shortlistedCandidates, scenario]);

  const gaugeAngle = (overallScore / 100) * 270;
  const gaugeColor = overallScore >= 80 ? 'hsl(135,50%,40%)' : overallScore >= 60 ? 'hsl(40,80%,48%)' : 'hsl(0,80%,62%)';

  const handleAiRecommend = async () => {
    if (!scenario || !projectConfig) return;
    setLoadingAi(true);
    try {
      const rosterEmps = employees.filter(e => roster.includes(e.employee_id));
      const result = await invokeAI<TeamRecommendations>('team-recommendations', {
        projectName: projectConfig.name,
        dimensions,
        overallScore,
        warnings: warnings.map(w => ({ type: w.type, text: w.text })),
        rosterSize: rosterEmps.length,
        scenarioLabel: scenario.label,
        roleBreakdown: scenario.roles.map(r => ({
          role: r.role,
          headcount: r.headcount,
          filled: rosterEmps.filter(e => {
            const empSkills = (e.technical_skills || '').toLowerCase();
            return r.requiredSkills.some(s => empSkills.includes(s.toLowerCase()));
          }).length,
        })),
      });
      setAiRecs(result);
      toast({ title: 'AI Team Analysis Complete', description: `Team Grade: ${result.teamGrade}` });
    } catch (err) {
      toast({ title: 'Analysis Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoadingAi(false);
    }
  };

  const gradeColors: Record<string, string> = { A: 'text-success', B: 'text-primary', C: 'text-warning', D: 'text-score-amber', F: 'text-destructive' };
  const effortColors: Record<string, string> = { Low: 'badge-green', Medium: 'badge-amber', High: 'badge-red' };

  if (!scenario) {
    return (<div><PageHeader title="Team Efficiency" /><div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario first.</p></div></div>);
  }

  return (
    <div>
      <PageHeader title="Team Efficiency" subtitle="Overall readiness assessment">
        <Button size="sm" onClick={handleAiRecommend} disabled={loadingAi}>
          <Sparkles size={14} className="mr-2" />{loadingAi ? 'Analyzing...' : aiRecs ? 'Refresh AI Analysis' : 'AI Team Recommendations'}
        </Button>
      </PageHeader>

      <div className="card-surface p-8 mb-6 flex flex-col items-center">
        <div className="flex items-center gap-6">
          <svg width="200" height="160" viewBox="0 0 200 160">
            <path d="M 20 140 A 80 80 0 1 1 180 140" fill="none" stroke="hsl(215,18%,14%)" strokeWidth="16" strokeLinecap="round" />
            <path d="M 20 140 A 80 80 0 1 1 180 140" fill="none" stroke={gaugeColor} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(gaugeAngle / 360) * 502} 502`} />
            <text x="100" y="120" textAnchor="middle" className="fill-foreground text-4xl font-bold">{overallScore}</text>
            <text x="100" y="145" textAnchor="middle" className="fill-muted-foreground text-xs">READINESS</text>
          </svg>
          {aiRecs && (
            <div className="text-center">
              <p className={`text-6xl font-black ${gradeColors[aiRecs.teamGrade]}`}>{aiRecs.teamGrade}</p>
              <p className="text-xs text-muted-foreground mt-1">AI Grade</p>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2 max-w-lg text-center">
          {roster.length > 0
            ? `Team readiness is at ${overallScore}%${overallScore < 70 ? ' — gaps in skills and certifications require attention before project launch.' : ' — strong foundation in place.'}`
            : 'Add team members to the roster to see readiness assessment.'}
        </p>
      </div>

      {/* AI Recommendations */}
      {aiRecs && (
        <div className="card-surface p-5 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">AI Team Recommendations</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{aiRecs.compositionAssessment}</p>
          <div className="bg-secondary rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-muted-foreground">Weakest Area: <span className="text-foreground">{aiRecs.weakestDimension}</span></p>
            <p className="text-xs text-muted-foreground mt-1">Fix: {aiRecs.weakestFix}</p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Improvement Actions</p>
          <div className="space-y-2">
            {aiRecs.improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-3 bg-secondary rounded-lg p-3">
                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{imp.action}</p>
                    <Badge variant={effortColors[imp.effort]}>{imp.effort} Effort</Badge>
                    <span className="text-xs text-success font-medium">+{imp.expectedScoreGain} pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{imp.impact}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">{aiRecs.gradeJustification}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {dimensions.map(d => (
          <div key={d.name} className="card-surface p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-sm font-medium text-foreground">{d.name}</h4>
              <span className={`text-lg font-bold ${getScoreColor(d.score)}`}>{d.score}</span>
            </div>
            <p className="text-xs text-muted-foreground">{d.explanation}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{d.data}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm mb-2">Alerts</h3>
          {warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add team members to see alerts.</p>
          ) : warnings.map((w, i) => {
            const Icon = warningIcons[w.type];
            return (
              <div key={i} className={`card-surface p-4 border-l-4 ${warningColors[w.type]} flex items-start gap-3`}>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{w.text}</p>
                  <button onClick={() => navigate(w.link)} className="text-xs text-primary mt-1 hover:underline">Resolve →</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card-surface p-5">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Competency Radar</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215,12%,52%)', fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Ideal" dataKey="ideal" stroke="rgba(255,255,255,0.15)" fill="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
              <Radar name="Team" dataKey="score" stroke="hsl(205,100%,45%)" fill="hsl(205,100%,35%)" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {rosterMembers.length > 0 && (
        <div className="card-surface overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left p-3 text-xs text-muted-foreground">Name</th><th className="text-left p-3 text-xs text-muted-foreground">Role</th><th className="text-left p-3 text-xs text-muted-foreground">Source</th><th className="text-left p-3 text-xs text-muted-foreground">Status</th><th className="text-left p-3 text-xs text-muted-foreground">Score</th><th className="text-left p-3 text-xs text-muted-foreground">Risk</th>
            </tr></thead>
            <tbody>
              {rosterMembers.map(m => (
                <tr key={m.name} className="border-b border-border hover:bg-secondary/30">
                  <td className="p-3 text-foreground font-medium">{m.name}</td><td className="p-3 text-muted-foreground">{m.role}</td><td className="p-3"><Badge variant={sourceColors[m.source] || 'badge-blue'}>{m.source}</Badge></td><td className="p-3 text-muted-foreground">{m.status}</td><td className="p-3"><span className={`font-bold ${getScoreColor(m.score)}`}>{m.score}</span></td><td className="p-3">{m.risk && <Badge variant="badge-red">⚠</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate('/workforce')}>Revise Team</Button>
        <Button onClick={() => { markPageComplete(9); navigate('/timeline'); }}>Approve & Continue</Button>
      </div>
    </div>
  );
}
