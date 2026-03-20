import { createContext, useContext, useEffect, useMemo, useState } from "react";

const GUEST_USER = {
  id: "local-guest",
  full_name: "Local Explorer",
  email: "guest@flowmap.local",
  role: "local",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(GUEST_USER);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const storedUser = window.localStorage.getItem("flowmap.user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        window.localStorage.removeItem("flowmap.user");
      }
    } else {
      window.localStorage.setItem("flowmap.user", JSON.stringify(GUEST_USER));
    }

    setIsLoadingAuth(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      currentUser: user,
      isAuthenticated: true,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout: (redirectPath = "/") => {
        window.localStorage.setItem("flowmap.user", JSON.stringify(GUEST_USER));
        setUser(GUEST_USER);

        if (typeof redirectPath === "string") {
          window.location.assign(redirectPath);
        }
      },
      navigateToLogin: () => {
        window.location.assign("/");
      },
      checkAppState: async () => {},
    }),
    [isLoadingAuth, user]
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
