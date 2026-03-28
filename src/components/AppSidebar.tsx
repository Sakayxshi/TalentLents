import { useLocation, useNavigate } from 'react-router-dom';
import { useStore, PageId } from '@/store/useStore';
import {
  Upload, LayoutDashboard, Users, BarChart3, GraduationCap,
  FileText, Trophy, DollarSign, Calendar, FileOutput,
  ChevronLeft, ChevronRight, CheckCircle2
} from 'lucide-react';
import { useState } from 'react';

const pages = [
  { id: 1 as PageId, label: 'Upload Database', icon: Upload, path: '/' },
  { id: 2 as PageId, label: 'Project Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 3 as PageId, label: 'Workforce Overview', icon: Users, path: '/workforce' },
  { id: 4 as PageId, label: 'Gap Analysis', icon: BarChart3, path: '/gap-analysis' },
  { id: 5 as PageId, label: 'Upskilling Paths', icon: GraduationCap, path: '/upskilling' },
  { id: 6 as PageId, label: 'Job Postings', icon: FileText, path: '/job-postings' },
  { id: 7 as PageId, label: 'Candidate Ranking', icon: Trophy, path: '/candidates' },
  { id: 8 as PageId, label: 'Costs', icon: DollarSign, path: '/costs' },

  { id: 10 as PageId, label: 'Timeline', icon: Calendar, path: '/timeline' },
  { id: 11 as PageId, label: 'Executive Summary', icon: FileOutput, path: '/summary' },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentPage, completedPages, setCurrentPage } = useStore();

  const handleNav = (page: typeof pages[0]) => {
    setCurrentPage(page.id);
    navigate(page.path);
  };

  return (
    <aside
      className={`flex flex-col border-r border-border bg-background transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } min-h-screen shrink-0`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        {!collapsed ? (
          <div>
            <h1 className="text-lg font-bold text-primary tracking-tight">TalentLens</h1>
            <p className="text-[11px] text-muted-foreground">Strategic Workforce Intelligence</p>
          </div>
        ) : (
          <div className="text-primary font-bold text-center text-lg">TL</div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {pages.map((page, i) => {
          const isActive = location.pathname === page.path;
          const isComplete = completedPages.has(page.id);
          const Icon = page.icon;

          return (
            <button
              key={page.id}
              onClick={() => handleNav(page)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r" />
              )}
              <div className="relative shrink-0">
                <Icon size={18} />
              </div>
              {!collapsed && (
                <>
                  <span className="truncate">{page.label}</span>
                  {isComplete && (
                    <CheckCircle2 size={14} className="ml-auto text-success shrink-0" />
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4 flex items-center justify-between">
        {!collapsed && (
          <span className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">BMW Group</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
