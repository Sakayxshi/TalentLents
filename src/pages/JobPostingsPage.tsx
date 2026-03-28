import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { RefreshCw, Copy, FileText } from 'lucide-react';

const mockPostings = [
  { id: '1', role: 'Senior Battery Engineer', dept: 'Engineering', location: 'Munich', salary: '€85k-€110k', status: 'Ready' as const },
  { id: '2', role: 'Data Scientist — Manufacturing', dept: 'Data & Analytics', location: 'Munich', salary: '€75k-€95k', status: 'Draft' as const },
  { id: '3', role: 'Quality Assurance Lead', dept: 'Quality', location: 'Munich', salary: '€70k-€90k', status: 'Draft' as const },
  { id: '4', role: 'Automation Engineer', dept: 'Engineering', location: 'Munich', salary: '€80k-€100k', status: 'Ready' as const },
  { id: '5', role: 'Safety & Compliance Specialist', dept: 'Operations', location: 'Munich', salary: '€65k-€85k', status: 'Draft' as const },
  { id: '6', role: 'Supply Chain Analyst', dept: 'Logistics', location: 'Munich', salary: '€60k-€80k', status: 'Posted' as const },
];

const statusColors = { Draft: 'badge-amber', Ready: 'badge-green', Posted: 'badge-blue' };

const generateDescription = (role: string) => ({
  opening: `BMW Group is embarking on a transformative initiative to establish a cutting-edge EV Battery Gigafactory in Munich. We're seeking a talented ${role} to join our pioneering team.`,
  overview: `As a ${role}, you will play a critical role in scaling our battery manufacturing capabilities. You'll work alongside world-class engineers and contribute to BMW's vision of sustainable mobility.`,
  required: ['5+ years relevant experience', 'Bachelor\'s in Engineering or related field', 'Strong analytical skills', 'Experience with automotive manufacturing'],
  preferred: ['Master\'s degree', 'German language skills', 'EV/battery industry experience', 'Six Sigma certification'],
  offers: 'Competitive compensation, relocation support, BMW vehicle program, flexible working, continuous learning budget, and the opportunity to shape the future of electric mobility.',
});

export default function JobPostingsPage() {
  const [selectedId, setSelectedId] = useState(mockPostings[0].id);
  const selected = mockPostings.find(p => p.id === selectedId)!;
  const desc = generateDescription(selected.role);

  return (
    <div>
      <PageHeader title="Job Postings" subtitle="AI-generated position descriptions">
        <Button size="sm"><FileText size={14} className="mr-2" />Generate All Postings</Button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Open" value={mockPostings.length} />
        <MetricCard label="Drafted" value={mockPostings.filter(p => p.status === 'Draft').length} />
        <MetricCard label="Ready" value={mockPostings.filter(p => p.status === 'Ready').length} />
        <MetricCard label="Est. Recruiting Cost" value="€126k" />
      </div>

      <div className="flex gap-4">
        {/* Left list */}
        <div className="w-[35%] shrink-0 space-y-2">
          {mockPostings.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left card-surface p-4 transition-all ${selectedId === p.id ? 'ring-2 ring-primary' : ''}`}
            >
              <h4 className="font-medium text-foreground text-sm">{p.role}</h4>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{p.location} · {p.salary}</span>
                <Badge variant={statusColors[p.status]}>{p.status}</Badge>
              </div>
            </button>
          ))}
        </div>

        {/* Right detail */}
        <div className="flex-1 card-surface p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">{selected.role}</h2>
              <p className="text-sm text-muted-foreground">{selected.dept} · {selected.location} · {selected.salary}</p>
            </div>
            <Badge variant={statusColors[selected.status]}>{selected.status}</Badge>
          </div>

          <div className="space-y-5 text-sm">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Opening</h3>
                <button className="text-muted-foreground hover:text-primary"><RefreshCw size={13} /></button>
              </div>
              <p className="text-foreground leading-relaxed">{desc.opening}</p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Role Overview</h3>
                <button className="text-muted-foreground hover:text-primary"><RefreshCw size={13} /></button>
              </div>
              <p className="text-foreground leading-relaxed">{desc.overview}</p>
            </div>
            <div>
              <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Required Qualifications</h3>
              <div className="flex flex-wrap gap-1.5">
                {desc.required.map(q => <span key={q} className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground">{q}</span>)}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Preferred Qualifications</h3>
              <div className="flex flex-wrap gap-1.5">
                {desc.preferred.map(q => <span key={q} className="px-2.5 py-1 text-xs rounded-md badge-blue">{q}</span>)}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">What BMW Offers</h3>
              <p className="text-foreground leading-relaxed">{desc.offers}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-6 border-t border-border pt-4">
            <Button size="sm" variant="outline"><Copy size={14} className="mr-2" />Copy</Button>
            <Button size="sm" variant="outline">LinkedIn Format</Button>
            <Button size="sm" variant="outline">PDF</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
