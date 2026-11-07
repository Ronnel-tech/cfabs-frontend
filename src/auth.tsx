import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./lib/api";
import type { Profile } from "./lib/types";
import { AuthContext } from "./lib/session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [expired, setExpired] = useState(false);
  const queryClient = useQueryClient();
  const signedIn = user !== null;

  useEffect(() => {
    const clear = () => {
      queryClient.clear();
      setUser(null);
      setExpired(true);
    };
    window.addEventListener("cfabs:expired", clear);
    return () => window.removeEventListener("cfabs:expired", clear);
  }, [queryClient]);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    const refreshProfile = () => {
      if (document.visibilityState !== "visible") return;
      void api
        .request<Profile>("/auth/me", { signal: controller.signal })
        .then((profile) => {
          if (!controller.signal.aborted) setUser(profile);
        })
        .catch(() => {});
    };
    const timer = window.setInterval(refreshProfile, 60_000);
    window.addEventListener("focus", refreshProfile);
    window.addEventListener("cfabs:profile-refresh", refreshProfile);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshProfile);
      window.removeEventListener("cfabs:profile-refresh", refreshProfile);
    };
  }, [signedIn]);

  async function signIn(email: string, password: string) {
    await api.login(email, password);
    try {
      const profile = await api.request<Profile>("/auth/me");
      queryClient.clear();
      setUser(profile);
      setExpired(false);
    } catch (error) {
      api.setTokens(null);
      throw error;
    }
  }
  async function signOut() {
    await api.logout();
    queryClient.clear();
    setUser(null);
    setExpired(false);
  }
  async function googleSignIn(credential: string, challenge: string) {
    await api.googleLogin(credential, challenge);
    try {
      const profile = await api.request<Profile>("/auth/me");
      queryClient.clear();
      setUser(profile);
      setExpired(false);
    } catch (error) {
      api.setTokens(null);
      throw error;
    }
  }
  return (
    <AuthContext.Provider value={{ user, expired, signIn, googleSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
