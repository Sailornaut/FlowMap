import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, BarChart3, Bookmark, Search, User, LogOut, X, Sparkles, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useNavigation } from "@/lib/NavigationContext";
import { getAccountSummary, createCheckoutSession, createPortalSession } from "@/lib/api-client";
import PageTransition from "./PageTransition";
import StackHeader from "./StackHeader";
import DeleteAccountModal from "./DeleteAccountModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/", icon: Search, label: "Analyze" },
  { path: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { path: "/saved", icon: Bookmark, label: "Saved" },
];

function PlanBadge({ tier }) {
  const label = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Free";
  return <Badge variant={tier === "free" ? "secondary" : "default"}>{label}</Badge>;
}

function ProfileSheet({ open, onClose, onLogout, onUpgrade, onManageBilling, account, user }) {
  const initials = (user?.full_name || user?.email || "TS")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[120]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "tween", ease: [0.25, 0.46, 0.45, 0.94], duration: 0.3 }}
            className="fixed bottom-0 left-0 right-0 z-[130] bg-card rounded-t-2xl shadow-2xl md:bottom-6 md:right-6 md:left-auto md:top-6 md:w-[360px] md:rounded-3xl md:border md:border-border"
            style={{
              padding: "1.5rem",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-6" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {initials || <User className="w-6 h-6 text-primary" />}
              </div>
              <div>
                <p className="font-semibold">{user?.full_name || "User"}</p>
                <p className="text-sm text-muted-foreground">{user?.email || ""}</p>
              </div>
              <button
                onClick={onClose}
                className="tap-target ml-auto flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-4 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Current plan</p>
                <PlanBadge tier={account?.tier || "free"} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {account?.usage?.used ?? 0} of {account?.usage?.limit ?? 0} monthly analyses used
              </p>
              <div className="mt-3 h-2 rounded-full bg-background overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      ((account?.usage?.used ?? 0) / Math.max(1, account?.usage?.limit ?? 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="default" className="w-full gap-2 justify-start h-11" onClick={onUpgrade}>
                <Sparkles className="w-4 h-4" />
                Upgrade plan
              </Button>
              <Button variant="outline" className="w-full gap-2 justify-start h-11" onClick={onManageBilling}>
                <CreditCard className="w-4 h-4" />
                Manage billing
              </Button>
              <Button variant="outline" className="w-full gap-2 justify-start h-11" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
              <DeleteAccountModal />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { activeTab, isChildRoute } = useNavigation();
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: account } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
    staleTime: 1000 * 30,
  });

  const handleUpgrade = async () => {
    try {
      const result = await createCheckoutSession("pro");
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error.message || "Could not start checkout.");
    }
  };

  const handleManageBilling = async () => {
    try {
      const result = await createPortalSession();
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error.message || "Could not open billing portal.");
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
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mb-3">
          <MapPin className="w-5 h-5 text-primary-foreground" />
        </div>
        <PlanBadge tier={account?.tier || currentUser?.billing_tier || "free"} />

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
            onClick={() => setProfileOpen(true)}
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
                  {account?.tier ? `${account.tier} plan` : currentUser?.billing_tier || "Account"}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={handleUpgrade}
            className="tap-target flex flex-col items-center gap-1 px-3 rounded-xl transition-all duration-200 w-16 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            title="Upgrade plan"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-medium">Pro</span>
          </button>
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
          onClick={() => setProfileOpen(true)}
          className="tap-target flex flex-col items-center gap-0.5 px-4 rounded-lg transition-colors text-muted-foreground"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={() => logout("/")}
        onUpgrade={handleUpgrade}
        onManageBilling={handleManageBilling}
        account={account}
        user={currentUser}
      />
    </div>
  );
}
