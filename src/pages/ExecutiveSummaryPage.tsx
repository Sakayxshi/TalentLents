import { useStore } from '@/store/useStore';
import { Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';

const radarData = [
  { subject: 'Skills', score: 76 },
  { subject: 'Experience', score: 82 },
  { subject: 'Certs', score: 54 },
  { subject: 'Collaboration', score: 88 },
  { subject: 'Availability', score: 71 },
  { subject: 'Resilience', score: 63 },
];

export default function ExecutiveSummaryPage() {
  const { projectConfig, scenarios, selectedScenarioId, roster, employees } = useStore();
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const readiness = 72;
  const gaugeColor = readiness >= 80 ? 'hsl(135,50%,40%)' : readiness >= 60 ? 'hsl(40,80%,48%)' : 'hsl(0,80%,62%)';

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Executive Summary</h1>
        <Button size="sm"><Download size={14} className="mr-2" />Export PDF</Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left 40% */}
        <div className="w-[40%] space-y-4 overflow-auto">
          {/* Project */}
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Project</h3>
            <h4 className="font-semibold text-foreground">{projectConfig?.name || 'EV Battery Gigafactory'}</h4>
            <div className="flex gap-2 mt-2">
              <Badge variant={projectConfig?.priority === 'Critical' ? 'badge-red' : 'badge-amber'}>{projectConfig?.priority || 'Critical'}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div><span className="text-muted-foreground">Budget:</span> <span className="text-foreground">€15-25M</span></div>
              <div><span className="text-muted-foreground">Deadline:</span> <span className="text-foreground">{projectConfig?.targetDeadline || 'Q3 2026'}</span></div>
            </div>
          </div>

          {/* Team Composition */}
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Team Composition</h3>
            <p className="text-4xl font-bold text-foreground">{scenario?.totalHeadcount || 95}</p>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="text-center p-2 rounded bg-secondary">
                <p className="text-foreground font-bold text-lg">64</p>
                <p className="text-muted-foreground">Internal</p>
              </div>
              <div className="text-center p-2 rounded bg-secondary">
                <p className="text-foreground font-bold text-lg">18</p>
                <p className="text-muted-foreground">Upskilled</p>
              </div>
              <div className="text-center p-2 rounded bg-secondary">
                <p className="text-foreground font-bold text-lg">13</p>
                <p className="text-muted-foreground">External</p>
              </div>
            </div>
          </div>

          {/* Scenario */}
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Selected Scenario</h3>
            <p className="text-foreground font-medium">{scenario?.label || 'Optimal'}</p>
            <p className="text-xs text-muted-foreground mt-1">Full staffing with internal-first approach, targeted external hires for critical gaps.</p>
          </div>

          {/* Cost */}
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Cost Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-foreground">{scenario?.costEstimate || '€18.5M'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Internal</span><span className="text-foreground">€890k</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">External</span><span className="text-foreground">€1.51M</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Per Head</span><span className="text-foreground">€25.2k</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Savings</span><span className="text-success font-medium">€1.2M (42%)</span></div>
            </div>
          </div>
        </div>

        {/* Right 60% */}
        <div className="flex-1 space-y-4 overflow-auto">
          {/* Readiness + Radar */}
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
              <ResponsiveContainer width="100%" height={140}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215,12%,52%)', fontSize: 9 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="hsl(205,100%,45%)" fill="hsl(205,100%,35%)" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Timeline bar */}
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Timeline</h3>
            <div className="relative h-8 bg-secondary rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-primary/30 rounded-l-full" style={{ width: '15%' }} />
              <div className="absolute top-0 h-full bg-primary rounded-l-full" style={{ width: '15%', left: '0%' }}>
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
              <span>Sep 2026</span>
              <span>Q4 2026</span>
            </div>
          </div>

          {/* Risks */}
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Top 3 Risks</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Badge variant="badge-red">High</Badge><span className="text-sm text-foreground">Battery Engineer shortage delays cell line setup</span></div>
              <div className="flex items-center gap-2"><Badge variant="badge-amber">Med</Badge><span className="text-sm text-foreground">7 flight-risk employees in critical positions</span></div>
              <div className="flex items-center gap-2"><Badge variant="badge-amber">Med</Badge><span className="text-sm text-foreground">External candidate notice periods cause 4-week gap</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="card-surface p-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Top 3 Actions</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm"><span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">1</span><span className="text-foreground">Fast-track battery engineering recruitment — post 13 positions immediately</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">2</span><span className="text-foreground">Initiate retention packages for 7 high flight-risk team members</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">3</span><span className="text-foreground">Begin upskilling cohort 1 (18 candidates) in Q1 to meet Q3 readiness</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border mt-4 pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Generated by TalentLens | {new Date().toLocaleDateString()} | {employees.length || 'N/A'} employees | Scenario: {scenario?.label || 'Optimal'}</span>
        <Button size="sm"><Download size={14} className="mr-2" />Export PDF</Button>
      </div>
    </div>
  );
}
