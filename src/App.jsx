import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { queryClientInstance } from "@/lib/query-client";
import PageNotFound from "@/lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import WorkspaceLayout from "@/components/layout/WorkspaceLayout";
import { NavigationProvider } from "@/lib/NavigationContext";
import AuthScreen from "@/components/auth/AuthScreen";
import Landing from "@/pages/Landing";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const SavedLocations = lazy(() => import("@/pages/SavedLocations"));

// Workspace pages (Phase 4)
const WorkspaceOverview = lazy(() => import("@/pages/workspace/WorkspaceOverview"));
const PropertyList = lazy(() => import("@/pages/workspace/PropertyList"));
const PropertyCreate = lazy(() => import("@/pages/workspace/PropertyCreate"));
const PropertyDetail = lazy(() => import("@/pages/workspace/PropertyDetail"));
const AnalysisList = lazy(() => import("@/pages/workspace/AnalysisList"));
const AnalysisDetail = lazy(() => import("@/pages/workspace/AnalysisDetail"));
const AnalysisReport = lazy(() => import("@/pages/workspace/AnalysisReport"));

// Phase 7 pages
const FollowUps = lazy(() => import("@/pages/workspace/FollowUps"));
const Outcomes = lazy(() => import("@/pages/workspace/Outcomes"));
const Lessons = lazy(() => import("@/pages/workspace/Lessons"));

function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function ProtectedApp({ layout }) {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (layout === "workspace") {
    return <WorkspaceLayout />;
  }

  return (
    <NavigationProvider>
      <AppLayout />
    </NavigationProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<ProtectedApp />}>
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="/saved"
          element={
            <Suspense fallback={<PageLoader />}>
              <SavedLocations />
            </Suspense>
          }
        />
        <Route
          path="/profile"
          element={
            <Suspense fallback={<PageLoader />}>
              <Profile />
            </Suspense>
          }
        />
      </Route>
      {/* Workspace routes (Phase 4 — internal analyst workspace) */}
      <Route element={<ProtectedApp layout="workspace" />}>
        <Route
          path="/workspace"
          element={
            <Suspense fallback={<PageLoader />}>
              <WorkspaceOverview />
            </Suspense>
          }
        />
        <Route
          path="/workspace/properties"
          element={
            <Suspense fallback={<PageLoader />}>
              <PropertyList />
            </Suspense>
          }
        />
        <Route
          path="/workspace/properties/new"
          element={
            <Suspense fallback={<PageLoader />}>
              <PropertyCreate />
            </Suspense>
          }
        />
        <Route
          path="/workspace/properties/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <PropertyDetail />
            </Suspense>
          }
        />
        <Route
          path="/workspace/analyses"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnalysisList />
            </Suspense>
          }
        />
        <Route
          path="/workspace/analyses/:id"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnalysisDetail />
            </Suspense>
          }
        />
        <Route
          path="/workspace/analyses/:id/report"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnalysisReport />
            </Suspense>
          }
        />
        <Route
          path="/workspace/follow-ups"
          element={
            <Suspense fallback={<PageLoader />}>
              <FollowUps />
            </Suspense>
          }
        />
        <Route
          path="/workspace/outcomes"
          element={
            <Suspense fallback={<PageLoader />}>
              <Outcomes />
            </Suspense>
          }
        />
        <Route
          path="/workspace/lessons"
          element={
            <Suspense fallback={<PageLoader />}>
              <Lessons />
            </Suspense>
          }
        />
      </Route>

      {/* Legacy route redirects — point old SaaS paths to workspace */}
      <Route path="/app" element={<Navigate to="/workspace" replace />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}
