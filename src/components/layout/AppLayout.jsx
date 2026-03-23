import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bookmark, Search, User, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useNavigation } from "@/lib/NavigationContext";
import { getAccountSummary, createCheckoutSession } from "@/lib/api-client";
import { getNextUpgradeTier, getPlanConfig } from "@/lib/plan-config";
import TrafficScoutLogo from "@/components/brand/TrafficScoutLogo";
import PageTransition from "./PageTransition";
import StackHeader from "./StackHeader";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/app", icon: Search, label: "Analyze" },
  { path: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { path: "/saved", icon: Bookmark, label: "Saved" },
];

function PlanBadge({ tier }) {
  const label = getPlanConfig(tier).label;
  return <Badge variant={tier === "free" ? "secondary" : "default"}>{label}</Badge>;
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { activeTab, isChildRoute } = useNavigation();

  const { data: account } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
    staleTime: 1000 * 30,
  });
  const currentTier = account?.tier || currentUser?.billing_tier || "free";
  const nextUpgradeTier = getNextUpgradeTier(currentTier);
  const nextUpgradeLabel = nextUpgradeTier ? getPlanConfig(nextUpgradeTier).label : null;

  const handleUpgrade = async (plan = nextUpgradeTier) => {
    if (!plan) return;

    try {
      const result = await createCheckoutSession(plan);
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error.message || "Could not start checkout.");
    }
  };

  const handleTabPress = (path) => {
    if (location.pathname === path) return;

    if (activeTab === path && isChildRoute) {
      navigate(path, { replace: true });
    } else {
      navigate(path);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className="hidden md:flex flex-col w-[96px] bg-card border-r border-border items-center gap-2 shrink-0"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <TrafficScoutLogo compact iconOnly variant="mark" className="mb-3" />
        <PlanBadge tier={currentTier} />

        {navItems.map((item) => {
          const isActive = activeTab === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleTabPress(item.path)}
              className={cn(
                "tap-target flex flex-col items-center gap-1 px-3 rounded-xl transition-all duration-200 w-16",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        <div className="mt-auto flex flex-col gap-2 items-center w-full px-3">
          <button
            onClick={() => navigate("/profile")}
            className="w-full rounded-2xl border border-border bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted"
            title="Open profile"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{currentUser?.full_name || "Profile"}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {account?.tier ? `${getPlanConfig(account.tier).label} plan` : getPlanConfig(currentTier).label}
                </p>
              </div>
            </div>
          </button>

          {nextUpgradeTier && (
            <button
              onClick={() => handleUpgrade(nextUpgradeTier)}
              className="tap-target flex flex-col items-center gap-1 px-3 rounded-xl transition-all duration-200 w-16 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              title={`Upgrade to ${nextUpgradeLabel}`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] font-medium">{nextUpgradeLabel}</span>
            </button>
          )}
          <button
            onClick={() => logout("/")}
            className="tap-target flex flex-col items-center gap-1 px-3 rounded-xl transition-all duration-200 w-16 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[10px] font-medium">Out</span>
          </button>
        </div>
      </aside>

      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <StackHeader />

        <main className="flex-1 overflow-hidden relative">
          <PageTransition>
            <div className="absolute inset-0 overflow-auto">
              <Outlet />
            </div>
          </PageTransition>
        </main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around z-30"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          paddingTop: "4px",
          paddingBottom: "calc(4px + env(safe-area-inset-bottom))",
        }}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleTabPress(item.path)}
              className={cn(
                "tap-target flex flex-col items-center gap-0.5 px-4 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => navigate("/profile")}
          className="tap-target flex flex-col items-center gap-0.5 px-4 rounded-lg transition-colors text-muted-foreground"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  );
}
