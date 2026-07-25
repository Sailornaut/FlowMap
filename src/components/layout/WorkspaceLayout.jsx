import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Building2,
  CalendarClock,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Target,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import TrafficScoutLogo from "@/components/brand/TrafficScoutLogo";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/workspace", icon: LayoutDashboard, label: "Overview", exact: true },
  { path: "/workspace/properties", icon: Building2, label: "Properties" },
  { path: "/workspace/analyses", icon: FlaskConical, label: "Analyses" },
  { path: "/workspace/follow-ups", icon: CalendarClock, label: "Follow-ups" },
  { path: "/workspace/outcomes", icon: Target, label: "Outcomes" },
  { path: "/workspace/lessons", icon: BookOpen, label: "Lessons" },
];

export default function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const isActive = (item) =>
    item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 bg-card border-r border-border shrink-0"
        style={{
          paddingTop: "calc(1.25rem + env(safe-area-inset-top))",
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="px-4 mb-6 flex items-center gap-2">
          <TrafficScoutLogo compact iconOnly variant="mark" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">TrafficScout</p>
            <Badge variant="outline" className="text-[10px]">
              Internal
            </Badge>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive(item)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-2 mt-auto space-y-1">
          <button
            onClick={() => navigate("/profile")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {currentUser?.full_name || "Profile"}
            </span>
          </button>
          <button
            onClick={() => logout("/")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around z-30"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          paddingTop: "4px",
          paddingBottom: "calc(4px + env(safe-area-inset-bottom))",
        }}
      >
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors",
              isActive(item)
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
