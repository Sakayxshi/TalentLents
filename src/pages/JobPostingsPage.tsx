import { useState, useMemo } from 'react';
import { useStore, JobPosting } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { RefreshCw, Copy, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SALARY_BAND_MIDPOINTS } from '@/lib/scoring';

const statusColors: Record<string, string> = { Draft: 'badge-amber', Ready: 'badge-green', Posted: 'badge-blue' };

function generateDescription(role: string, project: string, skills: string[]) {
  return {
    opening: `BMW Group is embarking on a transformative initiative — ${project}. We're seeking a talented ${role} to join our pioneering team and help shape the future of sustainable mobility.`,
    roleOverview: `As a ${role}, you will play a critical role in scaling our capabilities. You'll work alongside world-class engineers and cross-functional teams, contributing directly to BMW's strategic vision. This role requires strong technical expertise in ${skills.slice(0, 3).join(', ')}.`,
    requiredQualifications: [
      '5+ years relevant experience in automotive or related industry',
      `Strong proficiency in ${skills.slice(0, 2).join(' and ')}`,
      "Bachelor's or Master's in Engineering or related field",
      'Proven track record of successful project delivery',
      'Experience working in cross-functional agile teams',
    ],
    preferredQualifications: [
      "Master's or Ph.D. in relevant discipline",
      'German language skills (B2 or higher)',
      'EV/battery industry experience',
      `Certifications in ${skills.length > 2 ? skills[2] : 'relevant domain'}`,
    ],
    bmwOffers: 'Competitive compensation package, relocation support, BMW vehicle program, flexible working arrangements, continuous learning budget of €5,000/year, company pension scheme, and the unique opportunity to shape the future of electric mobility at one of the world\'s most prestigious automotive companies.',
  };
}

export default function JobPostingsPage() {
  const { scenarios, selectedScenarioId, projectConfig, roster, employees, jobPostings, setJobPostings, updateJobPosting, markPageComplete } = useStore();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const scenario = scenarios.find(s => s.id === selectedScenarioId);

  // Build postings from gaps
  const postings = useMemo(() => {
    if (jobPostings.length > 0) return jobPostings;
    if (!scenario) return [];
    return scenario.roles
      .filter(r => r.gap > 0)
      .map((r, i) => ({
        roleId: `post-${i}`,
        role: r.role,
        department: 'Engineering',
        location: projectConfig?.name?.includes('Munich') ? 'Munich' : 'Munich',
        salaryBand: 'E3-E5',
        status: 'Draft' as const,
        description: null,
      }));
  }, [scenario, jobPostings, projectConfig]);

  const selected = selectedId ? postings.find(p => p.roleId === selectedId) : postings[0];

  const handleGenerateAll = () => {
    setGenerating(true);
    const projectName = projectConfig?.name || 'Strategic Initiative';
    setTimeout(() => {
      const generated: JobPosting[] = postings.map(p => {
        const roleConfig = scenario?.roles.find(r => r.role === p.role);
        const skills = roleConfig?.requiredSkills || [];
        return {
          ...p,
          status: 'Ready' as const,
          description: generateDescription(p.role, projectName, skills),
        };
      });
      setJobPostings(generated);
      markPageComplete(6);
      setGenerating(false);
      toast({ title: 'Job Postings Generated', description: `${generated.length} postings created` });
    }, 1500);
  };

  const handleCopy = () => {
    if (!selected?.description) return;
    const d = selected.description;
    const text = `${selected.role}\n\n${d.opening}\n\n${d.roleOverview}\n\nRequired:\n${d.requiredQualifications.join('\n')}\n\nPreferred:\n${d.preferredQualifications.join('\n')}\n\nWhat BMW Offers:\n${d.bmwOffers}`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const totalOpen = postings.length;
  const drafted = postings.filter(p => p.status === 'Draft').length;
  const ready = postings.filter(p => p.status === 'Ready' || p.status === 'Posted').length;
  const estCost = postings.length * 0.18 * (SALARY_BAND_MIDPOINTS['E4'] || 78000);

  if (!scenario) {
    return (
      <div>
        <PageHeader title="Job Postings" />
        <div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario on the Dashboard first.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Job Postings" subtitle="AI-generated position descriptions">
        <Button size="sm" onClick={handleGenerateAll} disabled={generating}>
          <FileText size={14} className="mr-2" />{generating ? 'Generating...' : 'Generate All Postings'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Open" value={totalOpen} />
        <MetricCard label="Drafted" value={drafted} />
        <MetricCard label="Ready" value={ready} />
        <MetricCard label="Est. Recruiting Cost" value={`€${Math.round(estCost / 1000)}k`} />
      </div>

      <div className="flex gap-4">
        {/* Left list */}
        <div className="w-[35%] shrink-0 space-y-2">
          {postings.map(p => (
            <button
              key={p.roleId}
              onClick={() => setSelectedId(p.roleId)}
              className={`w-full text-left card-surface p-4 transition-all ${(selected?.roleId === p.roleId) ? 'ring-2 ring-primary' : ''}`}
            >
              <h4 className="font-medium text-foreground text-sm">{p.role}</h4>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{p.location} · {p.salaryBand}</span>
                <Badge variant={statusColors[p.status]}>{p.status}</Badge>
              </div>
            </button>
          ))}
        </div>

        {/* Right detail */}
        <div className="flex-1 card-surface p-6">
          {selected ? (
            <>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selected.role}</h2>
                  <p className="text-sm text-muted-foreground">{selected.department} · {selected.location} · {selected.salaryBand}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusColors[selected.status]}>{selected.status}</Badge>
                  {selected.description && (
                    <select
                      value={selected.status}
                      onChange={e => updateJobPosting(selected.roleId, { status: e.target.value as 'Draft' | 'Ready' | 'Posted' })}
                      className="h-7 text-xs rounded bg-input border border-border px-2 text-foreground"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Ready">Ready</option>
                      <option value="Posted">Posted</option>
                    </select>
                  )}
                </div>
              </div>

              {selected.description ? (
                <div className="space-y-5 text-sm">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Opening</h3>
                      <button className="text-muted-foreground hover:text-primary"><RefreshCw size={13} /></button>
                    </div>
                    <p className="text-foreground leading-relaxed">{selected.description.opening}</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Role Overview</h3>
                      <button className="text-muted-foreground hover:text-primary"><RefreshCw size={13} /></button>
                    </div>
                    <p className="text-foreground leading-relaxed">{selected.description.roleOverview}</p>
                  </div>
                  <div>
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Required Qualifications</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.description.requiredQualifications.map(q => <span key={q} className="px-2.5 py-1 text-xs rounded-md bg-secondary text-secondary-foreground">{q}</span>)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Preferred Qualifications</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.description.preferredQualifications.map(q => <span key={q} className="px-2.5 py-1 text-xs rounded-md badge-blue">{q}</span>)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">What BMW Offers</h3>
                    <p className="text-foreground leading-relaxed">{selected.description.bmwOffers}</p>
                  </div>
                  <div className="flex gap-2 mt-6 border-t border-border pt-4">
                    <Button size="sm" variant="outline" onClick={handleCopy}><Copy size={14} className="mr-2" />Copy</Button>
                    <Button size="sm" variant="outline">LinkedIn Format</Button>
                    <Button size="sm" variant="outline">PDF</Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Click "Generate All Postings" to create descriptions</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12"><p className="text-muted-foreground">Select a posting from the list</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
