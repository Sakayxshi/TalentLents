import { useState } from 'react';
import { FileText, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JobPostingsPage from './JobPostingsPage';
import CandidateRankingPage from './CandidateRankingPage';

type Tab = 'postings' | 'candidates';

export default function HiringPage() {
  const [tab, setTab] = useState<Tab>('postings');

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Button
          variant={tab === 'postings' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('postings')}
        >
          <FileText size={14} className="mr-2" />Job Postings
        </Button>
        <Button
          variant={tab === 'candidates' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('candidates')}
        >
          <Trophy size={14} className="mr-2" />Candidates
        </Button>
      </div>
      {tab === 'postings' ? <JobPostingsPage /> : <CandidateRankingPage />}
    </div>
  );
}
