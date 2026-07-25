import { LogOut, User, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import DeleteAccountModal from "@/components/layout/DeleteAccountModal";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const role = currentUser?.role || "analyst";

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {currentUser?.full_name || "TrafficScout account"}
                </h1>
                <p className="mt-1 text-sm text-slate-600">{currentUser?.email || ""}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={() => logout("/")}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Access</h2>
                <p className="text-sm text-slate-600">Your role and permissions.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Role</p>
                <p className="mt-3 text-lg font-semibold text-slate-950 capitalize">{role}</p>
              </div>
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Internal access active</p>
                <p className="mt-1 text-sm text-emerald-800">
                  Analysis, reporting, and all workspace features are available.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Account tools</h2>
            <p className="mt-2 text-sm text-slate-600">
              Manage your account settings or sign out.
            </p>

            <div className="mt-6 space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => logout("/")}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>

            <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-sm font-semibold text-rose-900">Danger zone</p>
              <p className="mt-2 text-sm text-rose-800">
                Clear locally saved location data for this account and sign out on this device.
              </p>
              <div className="mt-4">
                <DeleteAccountModal />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
