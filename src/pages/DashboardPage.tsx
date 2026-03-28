import { useState } from 'react';
import { useStore, Scenario, RoleRequirement } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Sparkles, AlertTriangle, TrendingUp, Users } from 'lucide-react';

const defaultRoles: RoleRequirement[] = [
  { role: 'Battery Engineer', headcount: 25, internalAvailable: 12, gap: 13 },
  { role: 'Project Manager', headcount: 8, internalAvailable: 6, gap: 2 },
  { role: 'Data Scientist', headcount: 12, internalAvailable: 5, gap: 7 },
  { role: 'Quality Engineer', headcount: 15, internalAvailable: 9, gap: 6 },
  { role: 'Supply Chain Analyst', headcount: 10, internalAvailable: 4, gap: 6 },
  { role: 'Automation Engineer', headcount: 14, internalAvailable: 7, gap: 7 },
  { role: 'Safety Specialist', headcount: 6, internalAvailable: 3, gap: 3 },
  { role: 'UX Designer', headcount: 5, internalAvailable: 4, gap: 1 },
];

const radarData = [
  { subject: 'Technical Depth', A: 78 },
  { subject: 'Leadership', A: 65 },
  { subject: 'Delivery Speed', A: 72 },
  { subject: 'Innovation', A: 58 },
  { subject: 'Collaboration', A: 81 },
  { subject: 'Certifications', A: 45 },
];

export default function DashboardPage() {
  const { projectConfig, setProjectConfig, scenarios, setScenarios, selectScenario, selectedScenarioId, markPageComplete, employees } = useStore();
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

  const handleGenerate = () => {
    setGenerating(true);
    setProjectConfig(form);

    // Count available internals from uploaded employee data
    const computeRoles = (multiplier: number): RoleRequirement[] =>
      defaultRoles.map(r => {
        const hc = Math.round(r.headcount * multiplier);
        const avail = employees.length > 0
          ? employees.filter(e => e.role?.toLowerCase().includes(r.role.split(' ')[0].toLowerCase())).length
          : r.internalAvailable;
        return { ...r, headcount: hc, internalAvailable: Math.min(avail, hc), gap: Math.max(0, hc - Math.min(avail, hc)) };
      });

    setTimeout(() => {
      const scenarioData: Scenario[] = [
        {
          id: 'optimal', name: 'Scenario A', label: 'Optimal',
          totalHeadcount: 95, costEstimate: '€18.5M', timeline: '9 months', risk: 'Low',
          roles: computeRoles(1),
        },
        {
          id: 'lean', name: 'Scenario B', label: 'Lean',
          totalHeadcount: 72, costEstimate: '€12.8M', timeline: '14 months', risk: 'Medium',
          roles: computeRoles(0.75),
        },
        {
          id: 'custom', name: 'Scenario C', label: 'Custom',
          totalHeadcount: 0, costEstimate: '—', timeline: '—', risk: 'Medium',
          roles: computeRoles(0).map(r => ({ ...r, headcount: 0, gap: 0 })),
        },
      ];
      setScenarios(scenarioData);
      setGenerating(false);
      markPageComplete(2);
    }, 1500);
  };

  const riskColors: Record<string, string> = { Low: 'badge-green', Medium: 'badge-amber', High: 'badge-red' };

  return (
    <div>
      <PageHeader title="Project Dashboard" subtitle="Configure your initiative and generate staffing scenarios" />

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
            <Input type="number" value={form.budgetMin} onChange={e => setForm({ ...form, budgetMin: Number(e.target.value) })} className="mt-1.5" />
          </div>
          <div>
            <Label>Budget Max (€)</Label>
            <Input type="number" value={form.budgetMax} onChange={e => setForm({ ...form, budgetMax: Number(e.target.value) })} className="mt-1.5" />
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
        <Button onClick={handleGenerate} disabled={generating} className="mt-6 w-full">
          <Sparkles size={16} className="mr-2" />
          {generating ? 'Generating Staffing Plan...' : 'Generate Staffing Plan'}
        </Button>
      </div>

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {scenarios.map(s => (
              <div key={s.id} className={`card-surface p-5 transition-all cursor-pointer ${selectedScenarioId === s.id ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.name}</p>
                    <h3 className="text-lg font-bold text-foreground">{s.label}</h3>
                  </div>
                  <Badge variant={riskColors[s.risk]}>{s.risk} Risk</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Headcount</span><span className="text-foreground font-medium">{s.totalHeadcount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="text-foreground font-medium">{s.costEstimate}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Timeline</span><span className="text-foreground font-medium">{s.timeline}</span></div>
                </div>
                <Button variant={selectedScenarioId === s.id ? 'default' : 'outline'} size="sm" className="mt-4 w-full" onClick={() => selectScenario(s.id)}>
                  {selectedScenarioId === s.id ? 'Selected' : 'Select Scenario'}
                </Button>
              </div>
            ))}
          </div>

          {/* Role Grid */}
          {selectedScenarioId && (
            <div className="card-surface p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4">Role Breakdown</h3>
              <div className="grid grid-cols-4 gap-3">
                {(scenarios.find(s => s.id === selectedScenarioId)?.roles || []).map(r => (
                  <div key={r.role} className="bg-secondary rounded-lg p-3">
                    <p className="text-sm font-medium text-foreground truncate">{r.role}</p>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Need: {r.headcount}</span>
                      <span className="text-success">Have: {r.internalAvailable}</span>
                    </div>
                    {r.gap > 0 && <p className="text-xs text-destructive mt-1">Gap: {r.gap}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Radar Chart */}
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
                {(scenarios.find(s => s.id === selectedScenarioId)?.roles || defaultRoles).slice(0, 6).map(r => (
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

          {/* Bottom cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-destructive" size={18} />
                <h4 className="font-semibold text-foreground text-sm">Critical Gaps</h4>
              </div>
              <p className="metric-value text-destructive">3</p>
              <p className="text-xs text-muted-foreground mt-2">Battery Engineer, Data Scientist, Automation Engineer</p>
            </div>
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-warning" size={18} />
                <h4 className="font-semibold text-foreground text-sm">Upskill Candidates</h4>
              </div>
              <p className="metric-value text-warning">18</p>
              <p className="text-xs text-muted-foreground mt-2">Avg skill match: 72% · Avg cost: €8,500</p>
            </div>
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="text-score-amber" size={18} />
                <h4 className="font-semibold text-foreground text-sm">Flight Risk Alerts</h4>
              </div>
              <p className="metric-value text-score-amber">7</p>
              <p className="text-xs text-muted-foreground mt-2">M. Schmidt, A. Weber, K. Fischer</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
