import { createContext, useContext } from "react";
import type { Profile } from "./types";

type Session = {
  user: Profile | null;
  expired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  googleSignIn: (credential: string, challenge: string) => Promise<void>;
  signOut: () => Promise<void>;
};
export const AuthContext = createContext<Session | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
