import { useState } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

export default function AuthScreen() {
  const { signIn, authConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSending(true);

    try {
      await signIn(email);
      toast.success("Check your inbox for the TrafficScout sign-in link.");
    } catch (error) {
      toast.error(error.message || "Could not send sign-in email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <ShieldCheck className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Sign in to TrafficScout</h1>
        <p className="text-sm text-muted-foreground mt-3">
          Free accounts get limited monthly analyses. Paid plans unlock higher quotas and billing tools.
        </p>

        {!authConfigured ? (
          <div className="mt-6 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900">
            Add your Supabase environment variables before using account sign-in.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pl-10"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSending || !email.trim()}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send magic link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
