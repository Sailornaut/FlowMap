import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const AuthContext = createContext(null);

async function loadProfile(user) {
  if (!user || !isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, billing_tier")
    .eq("id", user.id)
    .single();

  if (error) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "TrafficScout User",
      billing_tier: "free",
    };
  }

  return data;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoadingAuth(false);
      return;
    }

    let mounted = true;

    async function syncSession(nextSession) {
      setSession(nextSession);

      try {
        const nextProfile = await loadProfile(nextSession?.user);
        if (mounted) {
          setProfile(nextProfile);
          setAuthError(null);
        }
      } catch (error) {
        if (mounted) {
          console.error("Failed to load auth profile", error);
          setProfile(null);
          setAuthError(error);
        }
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    }

    async function bootstrap() {
      try {
        const {
          data: { session: nextSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        await syncSession(nextSession);
      } catch (error) {
        if (mounted) {
          console.error("Failed to bootstrap auth session", error);
          setSession(null);
          setProfile(null);
          setAuthError(error);
          setIsLoadingAuth(false);
        }
      }
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user: profile,
      currentUser: profile,
      session,
      isAuthenticated: Boolean(session?.user),
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authConfigured: isSupabaseConfigured,
      signIn: async (email) => {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error("Supabase is not configured.");
        }

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });

        if (error) {
          throw error;
        }
      },
      logout: async (redirectPath = "/") => {
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signOut();
        }

        if (typeof redirectPath === "string") {
          window.location.assign(redirectPath);
        }
      },
      navigateToLogin: () => {
        window.location.assign("/");
      },
      refreshProfile: async () => {
        try {
          setProfile(await loadProfile(session?.user));
          setAuthError(null);
        } catch (error) {
          console.error("Failed to refresh auth profile", error);
          setAuthError(error);
          throw error;
        }
      },
    }),
    [authError, isLoadingAuth, profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
