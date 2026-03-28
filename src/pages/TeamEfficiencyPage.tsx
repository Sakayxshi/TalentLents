import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const dimensions = [
  { name: 'Skill Coverage', score: 76, explanation: 'Team covers 76% of required technical competencies', data: '38/50 skills covered' },
  { name: 'Experience Depth', score: 82, explanation: 'Strong average tenure with deep domain expertise', data: 'Avg 7.2 years experience' },
  { name: 'Certification Coverage', score: 54, explanation: 'Several key certifications are underrepresented', data: '12/22 certs covered' },
  { name: 'Collaboration', score: 88, explanation: 'High peer feedback scores indicate strong teamwork', data: 'Avg peer score: 4.2/5' },
  { name: 'Availability', score: 71, explanation: 'Most candidates available within project timeline', data: '68% available in Q1' },
  { name: 'Risk Resilience', score: 63, explanation: 'Some flight risk concentrations in key roles', data: '7 high-risk members' },
];

const radarData = dimensions.map(d => ({ subject: d.name, score: d.score, ideal: 85 }));
const overallScore = Math.round(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);

const warnings = [
  { type: 'critical' as const, text: 'Battery Engineer role has only 48% coverage — 13 positions remain unfilled', link: '/gap-analysis' },
  { type: 'warning' as const, text: '7 high flight-risk employees currently on roster — retention actions recommended', link: '/workforce' },
  { type: 'positive' as const, text: 'Data Science team fully staffed with 92% average competency score', link: '/workforce' },
];

const warningIcons = { critical: AlertTriangle, warning: Info, positive: CheckCircle2 };
const warningColors = { critical: 'border-l-destructive bg-destructive/5', warning: 'border-l-warning bg-warning/5', positive: 'border-l-success bg-success/5' };

const rosterMembers = [
  { name: 'M. Schmidt', role: 'Battery Engineer', source: 'Internal', status: 'Active', score: 87, risk: false },
  { name: 'K. Weber', role: 'Battery Engineer', source: 'Upskilled', status: 'Training', score: 72, risk: false },
  { name: 'A. Müller', role: 'Data Scientist', source: 'External', status: 'Notice Period', score: 91, risk: true },
  { name: 'L. Fischer', role: 'Quality Engineer', source: 'Internal', status: 'Active', score: 78, risk: false },
  { name: 'T. Braun', role: 'Automation Eng.', source: 'External', status: 'Active', score: 84, risk: false },
];

const sourceColors = { Internal: 'badge-blue', Upskilled: 'badge-teal', External: 'badge-coral' };

export default function TeamEfficiencyPage() {
  const navigate = useNavigate();

  const gaugeAngle = (overallScore / 100) * 270;
  const gaugeColor = overallScore >= 80 ? 'hsl(135,50%,40%)' : overallScore >= 60 ? 'hsl(40,80%,48%)' : 'hsl(0,80%,62%)';

  return (
    <div>
      <PageHeader title="Team Efficiency" subtitle="Overall readiness assessment" />

      {/* Hero gauge */}
      <div className="card-surface p-8 mb-6 flex flex-col items-center">
        <svg width="200" height="160" viewBox="0 0 200 160">
          <path d="M 20 140 A 80 80 0 1 1 180 140" fill="none" stroke="hsl(215,18%,14%)" strokeWidth="16" strokeLinecap="round" />
          <path
            d="M 20 140 A 80 80 0 1 1 180 140"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${(gaugeAngle / 360) * 502} 502`}
          />
          <text x="100" y="120" textAnchor="middle" className="fill-foreground text-4xl font-bold">{overallScore}</text>
          <text x="100" y="145" textAnchor="middle" className="fill-muted-foreground text-xs">READINESS</text>
        </svg>
        <p className="text-sm text-muted-foreground mt-2 max-w-lg text-center">
          Team readiness is at {overallScore}% — certification gaps and flight risk require attention before project launch.
        </p>
      </div>

      {/* Dimension cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {dimensions.map(d => (
          <div key={d.name} className="card-surface p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-sm font-medium text-foreground">{d.name}</h4>
              <span className={`text-lg font-bold ${d.score >= 80 ? 'score-green' : d.score >= 60 ? 'score-amber' : 'score-red'}`}>{d.score}</span>
            </div>
            <p className="text-xs text-muted-foreground">{d.explanation}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{d.data}</p>
          </div>
        ))}
      </div>

      {/* Warnings + Radar */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm mb-2">Alerts</h3>
          {warnings.map((w, i) => {
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

      {/* Roster table */}
      <div className="card-surface overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-xs text-muted-foreground">Name</th>
              <th className="text-left p-3 text-xs text-muted-foreground">Role</th>
              <th className="text-left p-3 text-xs text-muted-foreground">Source</th>
              <th className="text-left p-3 text-xs text-muted-foreground">Status</th>
              <th className="text-left p-3 text-xs text-muted-foreground">Score</th>
              <th className="text-left p-3 text-xs text-muted-foreground">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rosterMembers.map(m => (
              <tr key={m.name} className="border-b border-border hover:bg-secondary/30">
                <td className="p-3 text-foreground font-medium">{m.name}</td>
                <td className="p-3 text-muted-foreground">{m.role}</td>
                <td className="p-3"><Badge variant={sourceColors[m.source as keyof typeof sourceColors]}>{m.source}</Badge></td>
                <td className="p-3 text-muted-foreground">{m.status}</td>
                <td className="p-3"><span className={`font-bold ${m.score >= 80 ? 'score-green' : 'score-amber'}`}>{m.score}</span></td>
                <td className="p-3">{m.risk && <Badge variant="badge-red">⚠</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate('/workforce')}>Revise Team</Button>
        <Button onClick={() => navigate('/timeline')}>Approve & Continue</Button>
      </div>
    </div>
  );
}
