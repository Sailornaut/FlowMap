import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, LogOut, Sparkles, User, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { createCheckoutSession, createPortalSession, getAccountSummary } from "@/lib/api-client";
import DeleteAccountModal from "@/components/layout/DeleteAccountModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function PlanBadge({ tier }) {
  const label = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Free";
  return <Badge variant={tier === "free" ? "secondary" : "default"}>{label}</Badge>;
}

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { data: account, isLoading } = useQuery({
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

  const usageUsed = account?.usage?.used ?? 0;
  const usageLimit = account?.usage?.limit ?? 0;
  const usagePercent = Math.min(100, (usageUsed / Math.max(1, usageLimit || 1)) * 100);

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
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {currentUser?.full_name || "TrafficScout account"}
                  </h1>
                  <PlanBadge tier={account?.tier || currentUser?.billing_tier || "free"} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{currentUser?.email || ""}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="gap-2" onClick={handleUpgrade}>
                <Sparkles className="h-4 w-4" />
                Upgrade plan
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleManageBilling}>
                <CreditCard className="h-4 w-4" />
                Manage billing
              </Button>
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
                <h2 className="text-lg font-semibold text-slate-950">Plan and usage</h2>
                <p className="text-sm text-slate-600">Track your monthly analysis capacity and billing access.</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading account details...
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Current plan</p>
                    <div className="mt-3">
                      <PlanBadge tier={account?.tier || currentUser?.billing_tier || "free"} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Analyses used</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">{usageUsed}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Monthly limit</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">{usageLimit}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Usage progress</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {usageUsed} of {usageLimit} monthly analyses used
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{Math.round(usagePercent)}%</p>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${usagePercent}%` }} />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">Account tools</h2>
            <p className="mt-2 text-sm text-slate-600">
              Manage billing, change plan access, or clear saved account data from this browser.
            </p>

            <div className="mt-6 space-y-3">
              <Button className="w-full justify-start gap-2" onClick={handleUpgrade}>
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={handleManageBilling}>
                <CreditCard className="h-4 w-4" />
                Open billing portal
              </Button>
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
