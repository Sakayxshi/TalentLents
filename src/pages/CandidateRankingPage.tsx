import { useState, useMemo } from 'react';
import { useStore, ExternalCandidate } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { getScoreColor } from '@/lib/scoring';
import { Star, X, GitCompare } from 'lucide-react';

const mockCandidates: ExternalCandidate[] = Array.from({ length: 35 }, (_, i) => ({
  id: `ext-${i}`,
  name: ['Anna Müller','Thomas Weber','Sarah Fischer','Max Schmidt','Elena Braun','Felix Hoffmann','Laura Wagner','Jan Becker','Marie Schulz','David Krüger','Sophie Richter','Paul Neumann','Lea Schwarz','Tim Zimmermann','Klara Wolf','Nico Schäfer','Mia König','Lukas Peters','Hannah Lang','Moritz Frank','Emma Walter','Jonas Baumann','Lena Meier','Ben Huber','Amelie Koch','Philipp Weiß','Charlotte Hartmann','Simon Keller','Julia Lorenz','Niklas Bauer','Clara Berger','Mark Engel','Sophia Horn','Adrian Roth','Lisa Graf'][i],
  company: ['Siemens','BASF','Continental','Bosch','SAP','Infineon','Daimler','Volkswagen'][i % 8],
  role: ['Battery Engineer','Data Scientist','Quality Engineer','Automation Engineer','Supply Chain Analyst'][i % 5],
  targetRole: ['Battery Engineer','Data Scientist','Quality Engineer','Automation Engineer','Supply Chain Analyst'][i % 5],
  skills: ['Python','MATLAB','Battery Systems','Machine Learning','Six Sigma','AutoCAD','SAP','Tableau'].slice(0, 3 + (i % 4)),
  certifications: ['PMP','AWS Certified','Six Sigma Green Belt','ISO 9001 Auditor'].slice(0, 1 + (i % 3)),
  yearsExperience: 3 + (i % 12),
  salaryExpectation: 65000 + (i % 8) * 5000,
  noticePeriod: ['1 month','2 months','3 months','Immediate'][i % 4],
  compositeScore: Math.round(50 + Math.random() * 45),
  skillMatch: Math.round(55 + Math.random() * 40),
  education: ['M.Sc. Engineering','B.Sc. Computer Science','Ph.D. Chemistry','M.Sc. Data Science'][i % 4],
  location: ['Munich','Berlin','Stuttgart','Hamburg'][i % 4],
}));

const positions = ['Battery Engineer','Data Scientist','Quality Engineer','Automation Engineer','Supply Chain Analyst'];

type SortMode = 'best' | 'fast' | 'cost' | 'long';

export default function CandidateRankingPage() {
  const { shortlistedCandidates, shortlistCandidate, unshortlistCandidate } = useStore();
  const [selectedPosition, setSelectedPosition] = useState(positions[0]);
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const candidates = useMemo(() => {
    let filtered = mockCandidates.filter(c => c.targetRole === selectedPosition);
    switch (sortMode) {
      case 'fast': return filtered.sort((a, b) => a.noticePeriod.localeCompare(b.noticePeriod));
      case 'cost': return filtered.sort((a, b) => a.salaryExpectation - b.salaryExpectation);
      case 'long': return filtered.sort((a, b) => b.yearsExperience - a.yearsExperience);
      default: return filtered.sort((a, b) => b.compositeScore - a.compositeScore);
    }
  }, [selectedPosition, sortMode]);

  const toggleCompare = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  const compareData = mockCandidates.filter(c => compareIds.includes(c.id));

  return (
    <div>
      <PageHeader title="Candidate Ranking" subtitle="Evaluate and compare external candidates">
        <Button variant="outline" size="sm" onClick={() => setCompareIds([])} disabled={compareIds.length === 0}>
          <GitCompare size={14} className="mr-2" />Compare ({compareIds.length})
        </Button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Candidates" value={mockCandidates.length} />
        <MetricCard label="Shortlisted" value={shortlistedCandidates.length} />
        <MetricCard label="Avg Score" value={Math.round(mockCandidates.reduce((a, c) => a + c.compositeScore, 0) / mockCandidates.length)} />
        <MetricCard label="Positions" value={positions.length} />
      </div>

      <div className="flex gap-4">
        {/* Left */}
        <div className="w-[35%] shrink-0 space-y-2">
          {positions.map(p => {
            const count = mockCandidates.filter(c => c.targetRole === p).length;
            const top = Math.max(...mockCandidates.filter(c => c.targetRole === p).map(c => c.compositeScore));
            return (
              <button key={p} onClick={() => setSelectedPosition(p)} className={`w-full text-left card-surface p-4 transition-all ${selectedPosition === p ? 'ring-2 ring-primary' : ''}`}>
                <h4 className="font-medium text-foreground text-sm">{p}</h4>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{count} applicants</span>
                  <span>Top: <span className={getScoreColor(top)}>{top}</span></span>
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
            return (
              <div key={c.id} className="card-surface p-4 animate-fade-in-up">
                <div className="flex items-start gap-4">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${getScoreColor(c.compositeScore)}`}>{c.compositeScore}</p>
                    <p className="text-[10px] text-muted-foreground">SCORE</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">{c.name}</h4>
                        <p className="text-xs text-muted-foreground">{c.company} · {c.role} · {c.yearsExperience} yrs</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>€{c.salaryExpectation.toLocaleString()}</p>
                        <p>{c.noticePeriod}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.skills.map(s => <span key={s} className="px-2 py-0.5 text-xs rounded badge-green">{s}</span>)}
                      {c.certifications.map(cert => <span key={cert} className="px-2 py-0.5 text-xs rounded badge-blue">{cert}</span>)}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant={isShortlisted ? 'outline' : 'default'} onClick={() => isShortlisted ? unshortlistCandidate(c.id) : shortlistCandidate(c.id)}>
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
              {(['compositeScore','skillMatch','yearsExperience','salaryExpectation','noticePeriod','education'] as const).map(attr => (
                <tr key={attr} className="border-b border-border">
                  <td className="p-2 text-muted-foreground capitalize">{attr.replace(/([A-Z])/g, ' $1')}</td>
                  {compareData.map(c => {
                    const val = c[attr];
                    return <td key={c.id} className="p-2 text-foreground">{typeof val === 'number' ? (attr === 'salaryExpectation' ? `€${val.toLocaleString()}` : val) : val}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
