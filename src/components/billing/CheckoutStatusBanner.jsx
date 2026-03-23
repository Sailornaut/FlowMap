import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { getAccountSummary, getCheckoutSessionStatus } from "@/lib/api-client";
import { getPlanConfig } from "@/lib/plan-config";
import { Button } from "@/components/ui/button";

const FINALIZATION_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 2000;

export default function CheckoutStatusBanner() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [startedAt] = useState(() => Date.now());
  const status = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");

  const isAddonCheckout = status === "addon-success";
  const shouldPoll = status === "success" || status === "addon-success";
  const isTimedOut = Date.now() - startedAt > FINALIZATION_TIMEOUT_MS;

  const { data: syncPayload, isFetching } = useQuery({
    queryKey: ["checkout-status-account", status, sessionId],
    queryFn: () => (sessionId ? getCheckoutSessionStatus(sessionId) : getAccountSummary()),
    enabled: shouldPoll,
    staleTime: 0,
    refetchInterval: shouldPoll ? POLL_INTERVAL_MS : false,
    retry: 1,
  });
  const account = syncPayload?.usage ? syncPayload : syncPayload;

  const checkoutCompleted = Boolean(syncPayload?.completed || (!sessionId && account));

  const upgradedTier = useMemo(() => {
    if (isAddonCheckout || !account?.tier || account.tier === "free") {
      return null;
    }

    return getPlanConfig(account.tier).label;
  }, [account?.tier, isAddonCheckout]);

  const addonPurchaseCompleted = useMemo(() => {
    if (!isAddonCheckout || !checkoutCompleted) {
      return false;
    }

    return Number(account?.usage?.purchasedCredits ?? 0) > 0 || Number(account?.usage?.remaining ?? 0) > 0;
  }, [account?.usage?.purchasedCredits, account?.usage?.remaining, checkoutCompleted, isAddonCheckout]);

  useEffect(() => {
    if (!upgradedTier && !addonPurchaseCompleted) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["account-summary"] });
    queryClient.invalidateQueries({ queryKey: ["saved-locations"] });
  }, [addonPurchaseCompleted, queryClient, upgradedTier]);

  const clearStatus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });
  };

  if (!status) {
    return null;
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-slate-100 p-2 text-slate-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Checkout was cancelled</p>
              <p className="mt-1 text-sm text-slate-600">
                No changes were made to your plan. You can upgrade again whenever you’re ready.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearStatus}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (addonPurchaseCompleted) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-950">Your add-on analysis is ready</p>
              <p className="mt-1 text-sm text-emerald-900">
                Your account now includes {account?.usage?.purchasedCredits ?? 0} purchased add-on
                {(account?.usage?.purchasedCredits ?? 0) === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearStatus}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (upgradedTier) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-950">Your plan is active</p>
              <p className="mt-1 text-sm text-emerald-900">
                {upgradedTier} access is now live and ready to use.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearStatus}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-white p-2 text-sky-700">
            <Loader2 className={`h-5 w-5 ${isFetching ? "animate-spin" : ""}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-sky-950">
              {isAddonCheckout ? "Finalizing your add-on analysis" : "Finalizing your upgrade"}
            </p>
            <p className="mt-1 text-sm text-sky-900">
              {isTimedOut
                ? isAddonCheckout
                  ? "Payment was received and your account is still syncing. Refresh in a moment if the new analysis credit does not appear yet."
                  : "Payment was received and your account is still syncing. Refresh in a moment if the new plan does not appear yet."
                : isAddonCheckout
                  ? "We’re syncing your purchased analysis credit with your account now."
                  : "We’re syncing your new plan with your account now."}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clearStatus}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
