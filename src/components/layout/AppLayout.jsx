import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { MapPin, BarChart3, Bookmark, Search, User, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigation, TAB_ROOTS } from "@/lib/NavigationContext";
import PageTransition from "./PageTransition";
import StackHeader from "./StackHeader";
import DeleteAccountModal from "./DeleteAccountModal";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/",          icon: Search,   label: "Analyze"   },
  { path: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { path: "/saved",     icon: Bookmark,  label: "Saved"     },
];

/* ── Profile bottom sheet (mobile) ──────────────────────────────── */
function ProfileSheet({ open, onClose, user }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "tween", ease: [0.25, 0.46, 0.45, 0.94], duration: 0.3 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-2xl md:hidden"
            style={{
              padding: "1.5rem",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-6" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
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
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="w-full gap-2 justify-start h-11"
                onClick={() => base44.auth.logout("/")}>
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

/* ── Main layout ─────────────────────────────────────────────────── */
export default function AppLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { currentUser }  = useAuth();
  const { activeTab, isChildRoute } = useNavigation();
  const [profileOpen, setProfileOpen] = useState(false);

  // When a bottom-tab is tapped while already on that tab → pop to root of tab
  const handleTabPress = (path) => {
    if (location.pathname === path) return; // already here
    if (activeTab === path && isChildRoute) {
      // Pop back to tab root
      navigate(path, { replace: true });
    } else {
      navigate(path);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-[72px] bg-card border-r border-border items-center gap-2 shrink-0"
        style={{
          paddingTop:    "calc(1.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mb-6">
          <MapPin className="w-5 h-5 text-primary-foreground" />
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleTabPress(item.path)}
              className={cn(
                "tap-target flex flex-col items-center gap-1 px-3 rounded-xl transition-all duration-200 w-14",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}

        <div className="mt-auto">
          <button
            onClick={() => base44.auth.logout("/")}
            className="tap-target flex flex-col items-center gap-1 px-3 rounded-xl transition-all duration-200 w-14 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[10px] font-medium">Out</span>
          </button>
        </div>
      </aside>

      {/* ── Content area ─────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >

        {/* Stack header — only visible on child routes */}
        <StackHeader />

        {/* Page with transition */}
        <main className="flex-1 overflow-hidden relative">
          <PageTransition>
            <div className="absolute inset-0 overflow-auto">
              <Outlet />
            </div>
          </PageTransition>
        </main>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around z-30"
        style={{
          paddingLeft:   "env(safe-area-inset-left)",
          paddingRight:  "env(safe-area-inset-right)",
          paddingTop:    "4px",
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

        {/* Profile */}
        <button
          onClick={() => setProfileOpen(true)}
          className="tap-target flex flex-col items-center gap-0.5 px-4 rounded-lg transition-colors text-muted-foreground"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>

      {/* Profile sheet */}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} user={currentUser} />
    </div>
  );
}