import { useState, useCallback, useMemo } from 'react';
import { useStore, Scenario, RoleRequirement } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Sparkles, AlertTriangle, TrendingUp, Users, CheckCircle2, XCircle, ChevronDown, ChevronUp, Pencil, Brain, Search, Plus, Minus, UserPlus, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateCompositeScore } from '@/lib/scoring';
import { invokeAI, GeneratedScenarios } from '@/lib/aiService';
import { ScrollArea } from '@/components/ui/scroll-area';

const roleSkillsMap: Record<string, { skills: string[]; certs: string[] }> = {
  'Battery Engineer': { skills: ['battery chemistry', 'thermal management', 'bms design', 'cell testing'], certs: ['ISO 26262', 'EV Safety Level 2'] },
  'Data Scientist': { skills: ['python', 'machine learning', 'deep learning', 'sql', 'tableau'], certs: ['AWS Certified', 'TensorFlow Certificate'] },
  'Quality Engineer': { skills: ['six sigma', 'iso 9001', 'spc', 'root cause analysis', 'fmea'], certs: ['Six Sigma Green Belt', 'ISO 9001 Auditor'] },
  'Automation Engineer': { skills: ['plc programming', 'scada', 'robotics', 'industrial iot', 'autocad'], certs: ['PMP', 'ABB Robotics'] },
  'Supply Chain Analyst': { skills: ['sap mm', 'demand forecasting', 'logistics', 'power bi'], certs: ['APICS CSCP', 'SAP Certified'] },
  'Safety Specialist': { skills: ['hazop', 'risk assessment', 'iso 45001', 'emergency planning'], certs: ['NEBOSH', 'ISO 45001 Lead Auditor'] },
  'Project Manager': { skills: ['agile', 'jira', 'stakeholder management', 'budgeting', 'safe'], certs: ['PMP', 'SAFe Agilist'] },
  'UX Designer': { skills: ['figma', 'prototyping', 'user research', 'design systems', 'css'], certs: ['Google UX Certificate'] },
  'Software Engineer': { skills: ['c++', 'embedded systems', 'autosar', 'linux', 'git'], certs: ['AUTOSAR Certified'] },
  'Mechanical Engineer': { skills: ['cad', 'fea', 'solidworks', 'catia', 'structural analysis'], certs: ['CATIA V5 Certified'] },
  'Process Engineer': { skills: ['lean manufacturing', 'value stream', 'kaizen', 'process optimization'], certs: ['Lean Six Sigma Black Belt'] },
  'Materials Scientist': { skills: ['xrd', 'sem', 'polymer science', 'nanomaterials'], certs: ['Materials Science Professional'] },
};

function getProjectBasedNames(projectName: string): { optimalLabel: string; leanLabel: string } {
  const lower = projectName.toLowerCase();
  if (lower.includes('battery') || lower.includes('gigafactory') || lower.includes('ev')) {
    return { optimalLabel: 'Full-Scale Launch', leanLabel: 'Phased Rollout' };
  }
  if (lower.includes('software') || lower.includes('digital') || lower.includes('platform')) {
    return { optimalLabel: 'Rapid Delivery', leanLabel: 'Agile MVP' };
  }
  if (lower.includes('autonomous') || lower.includes('self-driving') || lower.includes('adas')) {
    return { optimalLabel: 'Accelerated Program', leanLabel: 'Core-First Approach' };
  }
  if (lower.includes('manufacturing') || lower.includes('production') || lower.includes('factory')) {
    return { optimalLabel: 'Full Production', leanLabel: 'Pilot Line' };
  }
  return { optimalLabel: 'Optimal Deployment', leanLabel: 'Lean Execution' };
}

function getProsCons(id: string, projectName: string): { pros: string[]; cons: string[] } {
  const lower = projectName.toLowerCase();
  const domain = lower.includes('battery') || lower.includes('ev') ? 'production' : 'delivery';
  if (id === 'optimal') {
    return {
      pros: [
        `Full team capacity ensures on-time ${domain}`,
        'Redundancy across critical roles reduces single-point-of-failure risk',
        'Enables parallel workstreams and faster iteration cycles',
        'Strong competitive positioning with fully-staffed teams',
      ],
      cons: [
        'Highest cost scenario — significant upfront investment required',
        'Larger team requires more coordination overhead',
        'Recruiting at scale may extend initial ramp-up period',
        'Higher burn rate if project scope changes',
      ],
    };
  }
  if (id === 'lean') {
    return {
      pros: [
        'Lower cost with focused resource allocation',
        'Smaller team is easier to coordinate and align',
        'Reduced financial risk if project pivots',
        'Forces prioritization of highest-impact activities',
      ],
      cons: [
        `Extended timeline may delay ${domain} milestones`,
        'Limited redundancy — key person dependencies increase risk',
        'May require phased feature delivery or scope reduction',
        'Team may face burnout from higher individual workloads',
      ],
    };
  }
  return { pros: [], cons: [] };
}

export default function DashboardPage() {
  const { projectConfig, setProjectConfig, scenarios, setScenarios, selectScenario, selectedScenarioId, markPageComplete, employees, addToRoster, removeFromRoster, roster } = useStore();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: projectConfig?.name || '',
    description: projectConfig?.description || '',
    targetDeadline: projectConfig?.targetDeadline || 'Q3 2026',
    budgetMin: projectConfig?.budgetMin || 15000000,
    budgetMax: projectConfig?.budgetMax || 25000000,
    priority: (projectConfig?.priority || 'Critical') as 'Critical' | 'High' | 'Medium',
    staffEstimate: projectConfig?.staffEstimate || '',
  });
  const [generating, setGenerating] = useState(false);
  const [expandedProsConsId, setExpandedProsConsId] = useState<string | null>(null);
  const [customSearch, setCustomSearch] = useState('');
  const [customRoleFilter, setCustomRoleFilter] = useState('All');

  const scenarioAssignCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scenarios.forEach(s => {
      if (s.id === 'custom') { counts[s.id] = 0; return; }
      if (s.id === selectedScenarioId) { counts[s.id] = roster.length; return; }
      counts[s.id] = s.roles.reduce((sum, r) => sum + Math.min(r.headcount, r.internalAvailable), 0);
    });
    return counts;
  }, [scenarios, selectedScenarioId, roster]);

  const computeInternalAvailable = useCallback((role: string, requiredSkills: string[]): number => {
    if (employees.length === 0) return 0;
    return employees.filter(emp => {
      const empSkills = (emp.technical_skills || '').toLowerCase();
      const roleMatch = emp.role?.toLowerCase().includes(role.split(' ')[0].toLowerCase());
      const skillMatch = requiredSkills.some(skill => empSkills.includes(skill.toLowerCase()));
      return roleMatch || skillMatch;
    }).length;
  }, [employees]);

  const handleGenerate = async () => {
    if (!form.name) {
      toast({ title: 'Missing Info', description: 'Please enter a project name', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setProjectConfig(form);

    try {
      // Build employee summary for AI
      const departments = [...new Set(employees.map(e => e.department))];
      const topRoles = [...new Set(employees.map(e => e.role))].slice(0, 10);
      const locations = [...new Set(employees.map(e => e.location))];
      const avgPerformance = employees.length > 0
        ? (employees.reduce((a, e) => a + (e.performance_rating || 3), 0) / employees.length).toFixed(1)
        : '3.0';

      const result = await invokeAI<GeneratedScenarios>('generate-scenarios', {
        projectConfig: form,
        employeeSummary: { total: employees.length, departments, topRoles, locations, avgPerformance },
      });

      // Map AI response to app format, computing internalAvailable from actual employee data
      const scenarioData: Scenario[] = result.scenarios.map(s => ({
        ...s,
        roles: s.roles.map(r => {
          const avail = computeInternalAvailable(r.role, r.requiredSkills);
          const internalAvailable = Math.min(avail, r.headcount);
          return {
            ...r,
            internalAvailable,
            gap: Math.max(0, r.headcount - internalAvailable),
          };
        }),
      }));

      setScenarios(scenarioData);
      markPageComplete(2);
      toast({ title: 'AI Staffing Plan Generated', description: `${scenarioData.length} scenarios created by AI` });
    } catch (err) {
      console.error('Scenario generation failed:', err);
      toast({ title: 'Generation Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRoleHeadcountChange = useCallback((scenarioId: string, roleIndex: number, newHeadcount: number) => {
    const updated = scenarios.map(s => {
      if (s.id !== scenarioId) return s;
      const newRoles = s.roles.map((r, i) => {
        if (i !== roleIndex) return r;
        const hc = Math.max(0, newHeadcount);
        const avail = computeInternalAvailable(r.role, r.requiredSkills);
        return { ...r, headcount: hc, internalAvailable: Math.min(avail, hc), gap: Math.max(0, hc - Math.min(avail, hc)) };
      });
      const totalHc = newRoles.reduce((sum, r) => sum + r.headcount, 0);
      return { ...s, roles: newRoles, totalHeadcount: totalHc, costEstimate: `€${(totalHc * 0.17).toFixed(1)}M` };
    });
    setScenarios(updated);
  }, [scenarios, setScenarios, computeInternalAvailable]);

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

  const radarData = useMemo(() => {
    if (employees.length === 0 || !selectedScenario) {
      return [
        { subject: 'Technical Depth', A: 50 }, { subject: 'Leadership', A: 50 },
        { subject: 'Delivery Speed', A: 50 }, { subject: 'Innovation', A: 50 },
        { subject: 'Collaboration', A: 50 }, { subject: 'Certifications', A: 50 },
      ];
    }
    const allReqSkills = selectedScenario.roles.flatMap(r => r.requiredSkills);
    const matched = employees.filter(emp => {
      const empSkills = (emp.technical_skills || '').toLowerCase();
      return allReqSkills.some(s => empSkills.includes(s));
    });
    if (matched.length === 0) {
      return [
        { subject: 'Technical Depth', A: 30 }, { subject: 'Leadership', A: 30 },
        { subject: 'Delivery Speed', A: 30 }, { subject: 'Innovation', A: 30 },
        { subject: 'Collaboration', A: 30 }, { subject: 'Certifications', A: 30 },
      ];
    }
    const avgPerf = matched.reduce((a, e) => a + (e.performance_rating || 3), 0) / matched.length;
    const avgPeer = matched.reduce((a, e) => a + (e.peer_feedback_score || 3), 0) / matched.length;
    const avgSucc = matched.reduce((a, e) => a + (e.products_deployed > 0 ? (e.successful_products_deployed / e.products_deployed) * 100 : 50), 0) / matched.length;
    const certCount = matched.filter(e => (e.certifications || '').length > 0).length;

    return [
      { subject: 'Technical Depth', A: Math.round(avgPerf / 5 * 100) },
      { subject: 'Leadership', A: Math.round((matched.filter(e => e.project_position === 'Lead' || e.project_position === 'Core Contributor').length / matched.length) * 100) },
      { subject: 'Delivery Speed', A: Math.round(avgSucc) },
      { subject: 'Innovation', A: Math.round(matched.filter(e => e.internal_moves > 1).length / matched.length * 100) },
      { subject: 'Collaboration', A: Math.round(avgPeer / 5 * 100) },
      { subject: 'Certifications', A: Math.round((certCount / matched.length) * 100) },
    ];
  }, [employees, selectedScenario]);

  const bottomCards = useMemo(() => {
    if (!selectedScenario) return { criticalGaps: 0, criticalRoles: '', upskillCount: 0, avgSkillMatch: 0, flightRiskCount: 0, flightRiskNames: '' };
    const criticalRoles = selectedScenario.roles.filter(r => r.gap > r.headcount * 0.5);
    const highRisk = employees.filter(e => e.flight_risk?.toLowerCase() === 'high');
    const allReqSkills = selectedScenario.roles.flatMap(r => r.requiredSkills);
    const upskillPool = employees.filter(emp => {
      const empSkills = (emp.technical_skills || '').toLowerCase();
      const matchCount = allReqSkills.filter(s => empSkills.includes(s)).length;
      return matchCount > 0 && matchCount < allReqSkills.length * 0.8;
    });
    const avgMatch = upskillPool.length > 0
      ? Math.round(upskillPool.reduce((a, e) => {
          const sc = calculateCompositeScore(e, allReqSkills, []);
          return a + sc.skillMatchPct;
        }, 0) / upskillPool.length)
      : 0;

    return {
      criticalGaps: criticalRoles.length, criticalRoles: criticalRoles.map(r => r.role).join(', '),
      upskillCount: upskillPool.length, avgSkillMatch: avgMatch,
      flightRiskCount: highRisk.length, flightRiskNames: highRisk.slice(0, 3).map(e => e.name).join(', '),
    };
  }, [selectedScenario, employees]);

  const riskColors: Record<string, string> = { Low: 'badge-green', Medium: 'badge-amber', High: 'badge-red' };

  return (
    <div>
      <PageHeader title="Project Dashboard" subtitle="Configure your initiative and generate staffing scenarios" />

      {employees.length === 0 && (
        <div className="card-surface p-8 mb-6 text-center">
          <p className="text-muted-foreground">Please upload employee data first to enable scenario generation.</p>
        </div>
      )}

      {/* Form */}
      <div className="card-surface p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Project Name</Label>
            <Input placeholder="EV Battery Gigafactory — Munich" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>Target Deadline</Label>
            <select value={form.targetDeadline} onChange={e => setForm({ ...form, targetDeadline: e.target.value })} className="mt-1.5 w-full h-10 rounded-lg bg-input border border-border px-3 text-sm text-foreground">
              {['2026','2027','2028','2029','2030'].flatMap(y => ['Q1','Q2','Q3','Q4'].map(q => `${q} ${y}`)).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label>Project Description</Label>
            <Textarea placeholder="Describe your initiative..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1.5" rows={3} />
          </div>
          <div>
            <Label>Budget Min (€)</Label>
            <Input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.budgetMin}
              onChange={e => { const v = parseInt(e.target.value, 10); setForm({ ...form, budgetMin: isNaN(v) ? 0 : v }); }}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Budget Max (€)</Label>
            <Input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.budgetMax}
              onChange={e => { const v = parseInt(e.target.value, 10); setForm({ ...form, budgetMax: isNaN(v) ? 0 : v }); }}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Priority Level</Label>
            <div className="flex gap-3 mt-2">
              {(['Critical','High','Medium'] as const).map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="priority" checked={form.priority === p} onChange={() => setForm({ ...form, priority: p })} className="accent-primary" />
                  <span className="text-sm text-foreground">{p}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Staff Evaluation</Label>
            <Input placeholder="e.g. 80-120 people, heavy engineering" value={form.staffEstimate} onChange={e => setForm({ ...form, staffEstimate: e.target.value })} className="mt-1.5" />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={generating || employees.length === 0} className="mt-6 w-full">
          <Sparkles size={16} className="mr-2" />
          {generating ? 'Generating Staffing Plan...' : 'Generate Staffing Plan'}
        </Button>
      </div>

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {scenarios.map(s => (
              <div key={s.id} className="space-y-0">
                <div
                  className={`card-surface p-5 transition-all cursor-pointer ${selectedScenarioId === s.id ? 'ring-2 ring-primary' : ''} ${expandedProsConsId === s.id ? 'rounded-b-none' : ''}`}
                  onClick={() => setExpandedProsConsId(expandedProsConsId === s.id ? null : s.id)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.name}</p>
                      <h3 className="text-lg font-bold text-foreground">{s.label}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.risk !== 'None' && <Badge variant={riskColors[s.risk]}>{s.risk} Risk</Badge>}
                      {s.id !== 'custom' && (expandedProsConsId === s.id ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />)}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Headcount</span><span className="text-foreground font-medium">{s.totalHeadcount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="text-foreground font-medium">{s.costEstimate}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Timeline</span><span className="text-foreground font-medium">{s.timeline}</span></div>
                  </div>
                  {/* Roster assignment indicator */}
                  {s.id !== 'custom' && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                      <Users size={14} className="text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {s.id === selectedScenarioId ? 'Assigned' : 'Est. Internal'}
                          </span>
                          <span className="text-sm font-bold text-primary">{scenarioAssignCounts[s.id] || 0}</span>
                        </div>
                        <div className="h-1 bg-secondary rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${s.totalHeadcount > 0 ? Math.min(100, ((scenarioAssignCounts[s.id] || 0) / s.totalHeadcount) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    variant={selectedScenarioId === s.id ? 'default' : 'outline'}
                    size="sm"
                    className="mt-3 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectScenario(s.id);
                      if (s.id !== 'custom' && employees.length > 0) {
                        const currentRoster = useStore.getState().roster;
                        currentRoster.forEach(id => removeFromRoster(id));
                        const assigned = new Set<string>();
                        s.roles.forEach(role => {
                          const scored = employees
                            .filter(emp => !assigned.has(emp.employee_id))
                            .map(emp => ({ emp, score: calculateCompositeScore(emp, role.requiredSkills, role.requiredCerts, form.priority) }))
                            .sort((a, b) => b.score.total - a.score.total)
                            .slice(0, Math.min(role.headcount, role.internalAvailable));
                          scored.forEach(({ emp }) => { assigned.add(emp.employee_id); addToRoster(emp.employee_id); });
                        });
                        toast({ title: 'Scenario Selected', description: `${s.label} — ${assigned.size} employees auto-assigned to roster` });
                      } else {
                        toast({ title: 'Scenario Selected', description: s.label });
                      }
                    }}
                  >
                    {selectedScenarioId === s.id ? 'Selected' : 'Select Scenario'}
                  </Button>
                </div>

                {expandedProsConsId === s.id && s.pros.length > 0 && (
                  <div className="card-surface rounded-t-none border-t-0 p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-success uppercase tracking-wider mb-2">Pros</p>
                      <ul className="space-y-1.5">
                        {s.pros.map((pro, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 size={13} className="text-success mt-0.5 shrink-0" />{pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Cons</p>
                      <ul className="space-y-1.5">
                        {s.cons.map((con, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <XCircle size={13} className="text-destructive mt-0.5 shrink-0" />{con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {expandedProsConsId === s.id && s.id === 'custom' && (
                  <div className="card-surface rounded-t-none border-t-0 p-4">
                    <p className="text-xs text-muted-foreground italic">Configure role headcounts below to define your custom scenario.</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* AI Overview — only for A/B */}
          {selectedScenarioId && selectedScenario && selectedScenarioId !== 'custom' && (
            <div className="card-surface p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={18} className="text-primary" />
                <h3 className="font-semibold text-foreground">AI Project Analysis</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Based on the "{selectedScenario.label}" scenario for {form.name || 'this project'}, the team requires{' '}
                <span className="text-foreground font-medium">{selectedScenario.totalHeadcount}</span> professionals across{' '}
                <span className="text-foreground font-medium">{selectedScenario.roles.length}</span> roles. Currently,{' '}
                <span className="text-foreground font-medium">{selectedScenario.roles.reduce((s, r) => s + r.internalAvailable, 0)}</span> positions
                ({selectedScenario.totalHeadcount > 0 ? Math.round(selectedScenario.roles.reduce((s, r) => s + r.internalAvailable, 0) / selectedScenario.totalHeadcount * 100) : 0}%)
                can be filled internally, leaving a gap of{' '}
                <span className="text-foreground font-medium">{selectedScenario.roles.reduce((s, r) => s + r.gap, 0)}</span> positions.
                {bottomCards.criticalGaps > 0 && (
                  <> Critical shortages exist in <span className="text-destructive font-medium">{bottomCards.criticalRoles}</span> — these roles have over 50% unfilled capacity.</>
                )}
              </p>
            </div>
          )}

          {/* Role Breakdown with Save */}
          {selectedScenarioId && selectedScenario && (
            <div className="card-surface p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Pencil size={15} className="text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Role Breakdown</h3>
                  <span className="text-xs text-muted-foreground ml-1">— edit headcount to model different strategies</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    markPageComplete(2);
                    toast({ title: 'Distribution Saved', description: `${selectedScenario.totalHeadcount} total across ${selectedScenario.roles.length} roles` });
                  }}
                >
                  <Save size={14} className="mr-1.5" />
                  Save Distribution
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {selectedScenario.roles.map((r, idx) => (
                  <div key={r.role} className="bg-secondary rounded-lg p-3">
                    <p className="text-sm font-medium text-foreground truncate">{r.role}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <span>Need:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={r.headcount}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          handleRoleHeadcountChange(selectedScenarioId, idx, isNaN(val) ? 0 : val);
                        }}
                        className="w-12 bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {r.gap > 0 && <p className="text-xs text-destructive mt-1">Gap: {r.gap}</p>}
                    {r.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-2">
                        {r.requiredSkills.slice(0, 3).map(s => <span key={s} className="px-1 py-0 text-[9px] rounded bg-primary/10 text-primary">{s}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-sm border-t border-border pt-3">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="text-foreground font-bold">{selectedScenario.totalHeadcount} people</span>
              </div>
            </div>
          )}

          {/* Manual Employee Assignment for Scenario C */}
          {selectedScenarioId === 'custom' && employees.length > 0 && (
            <div className="card-surface p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={16} className="text-primary" />
                <h3 className="font-semibold text-foreground">Assign Employees to Roster</h3>
                <span className="text-xs text-muted-foreground ml-1">— search and add team members manually</span>
                {roster.length > 0 && (
                  <span className="ml-auto text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {roster.length} assigned
                  </span>
                )}
              </div>
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search by name, skills, or department..." value={customSearch} onChange={e => setCustomSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
                <select value={customRoleFilter} onChange={e => setCustomRoleFilter(e.target.value)} className="h-9 rounded-lg bg-secondary border border-border px-3 text-xs text-foreground">
                  <option value="All">All Roles</option>
                  {[...new Set(employees.map(e => e.role))].sort().map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <ScrollArea className="h-[320px]">
                <div className="space-y-1.5 pr-3">
                  {employees
                    .filter(emp => {
                      const search = customSearch.toLowerCase();
                      const matchesSearch = !search || emp.name.toLowerCase().includes(search) || (emp.technical_skills || '').toLowerCase().includes(search) || emp.department.toLowerCase().includes(search) || emp.role.toLowerCase().includes(search);
                      const matchesRole = customRoleFilter === 'All' || emp.role === customRoleFilter;
                      return matchesSearch && matchesRole;
                    })
                    .slice(0, 50)
                    .map(emp => {
                      const isOnRoster = roster.includes(emp.employee_id);
                      const allSkills = selectedScenario?.roles.flatMap(r => r.requiredSkills) || [];
                      const score = calculateCompositeScore(emp, allSkills, [], form.priority);
                      return (
                        <div key={emp.employee_id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isOnRoster ? 'bg-primary/8 border border-primary/15' : 'bg-secondary/50 border border-transparent hover:bg-secondary'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">{emp.name}</span>
                              {isOnRoster && <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Rostered</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{emp.role}</span>
                              <span className="text-[10px] text-muted-foreground/60">•</span>
                              <span className="text-xs text-muted-foreground">{emp.department}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 mr-2">
                            <span className={`text-sm font-bold ${score.total >= 80 ? 'text-success' : score.total >= 60 ? 'text-warning' : 'text-destructive'}`}>{score.total}</span>
                            <p className="text-[10px] text-muted-foreground">score</p>
                          </div>
                          <Button variant={isOnRoster ? 'outline' : 'default'} size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => {
                            if (isOnRoster) { removeFromRoster(emp.employee_id); toast({ title: 'Removed', description: `${emp.name} removed from roster` }); }
                            else { addToRoster(emp.employee_id); toast({ title: 'Added', description: `${emp.name} added to roster` }); }
                          }}>
                            {isOnRoster ? <Minus size={14} /> : <Plus size={14} />}
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Team Competency + Gap Analysis — after Role Breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card-surface p-5">
              <h3 className="font-semibold text-foreground mb-4">Team Competency Estimate</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215,12%,52%)', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Team" dataKey="A" stroke="hsl(205,100%,45%)" fill="hsl(205,100%,35%)" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="card-surface p-5">
              <h3 className="font-semibold text-foreground mb-4">Gap Analysis Preview</h3>
              <div className="space-y-3">
                {(selectedScenario?.roles || []).slice(0, 6).map(r => (
                  <div key={r.role}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{r.role}</span>
                      <span className="text-muted-foreground">{r.headcount} needed</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden flex">
                      <div className="bg-primary h-full rounded-l-full" style={{ width: `${(r.internalAvailable / Math.max(r.headcount, 1)) * 100}%` }} />
                      {r.gap > 0 && <div className="bg-destructive h-full" style={{ width: `${(r.gap / Math.max(r.headcount, 1)) * 100}%` }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-destructive" size={18} />
                <h4 className="font-semibold text-foreground text-sm">Critical Gaps</h4>
              </div>
              <p className="metric-value text-destructive">{bottomCards.criticalGaps}</p>
              <p className="text-xs text-muted-foreground mt-2">{bottomCards.criticalRoles || 'No critical gaps'}</p>
            </div>
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-warning" size={18} />
                <h4 className="font-semibold text-foreground text-sm">Upskill Candidates</h4>
              </div>
              <p className="metric-value text-warning">{bottomCards.upskillCount}</p>
              <p className="text-xs text-muted-foreground mt-2">Avg skill match: {bottomCards.avgSkillMatch}%</p>
            </div>
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="text-score-amber" size={18} />
                <h4 className="font-semibold text-foreground text-sm">Flight Risk Alerts</h4>
              </div>
              <p className="metric-value text-score-amber">{bottomCards.flightRiskCount}</p>
              <p className="text-xs text-muted-foreground mt-2">{bottomCards.flightRiskNames || 'No high-risk employees'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
