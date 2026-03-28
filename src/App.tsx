import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import WorkforcePage from "./pages/WorkforcePage";
import GapAnalysisPage from "./pages/GapAnalysisPage";
import UpskillingPage from "./pages/UpskillingPage";
import JobPostingsPage from "./pages/JobPostingsPage";
import CandidateRankingPage from "./pages/CandidateRankingPage";
import CostsPage from "./pages/CostsPage";

import TimelinePage from "./pages/TimelinePage";
import ExecutiveSummaryPage from "./pages/ExecutiveSummaryPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workforce" element={<WorkforcePage />} />
            <Route path="/gap-analysis" element={<GapAnalysisPage />} />
            <Route path="/upskilling" element={<UpskillingPage />} />
            <Route path="/job-postings" element={<JobPostingsPage />} />
            <Route path="/candidates" element={<CandidateRankingPage />} />
            <Route path="/costs" element={<CostsPage />} />

            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/summary" element={<ExecutiveSummaryPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
