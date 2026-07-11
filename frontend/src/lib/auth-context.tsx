"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, setAuthToken } from "./api-client";
import { CurrentUser } from "./types";

type AuthContextValue = {
  token: string | null;
  user: CurrentUser | null;
  isLoading: boolean;
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const router = useRouter();

  const loadUser = useCallback(async (t: string) => {
    setAuthToken(t);
    const me = await api.get<CurrentUser>("/api/auth/me");
    setUser(me);

    const storedOrg = typeof window !== "undefined" ? localStorage.getItem("currentOrgId") : null;
    if (storedOrg && me.organizations.some((o) => o.id === storedOrg)) {
      setCurrentOrgIdState(storedOrg);
    } else if (me.organizations.length > 0) {
      setCurrentOrgIdState(me.organizations[0].id);
      localStorage.setItem("currentOrgId", me.organizations[0].id);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      setToken(stored);
      loadUser(stored)
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [loadUser]);

  async function login(t: string) {
    localStorage.setItem("token", t);
    setToken(t);
    await loadUser(t);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("currentOrgId");
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setCurrentOrgIdState(null);
    router.push("/login");
  }

  function setCurrentOrgId(id: string) {
    setCurrentOrgIdState(id);
    localStorage.setItem("currentOrgId", id);
  }

  async function refreshUser() {
    if (token) await loadUser(token);
  }

  return (
    <AuthContext.Provider
      value={{ token, user, isLoading, currentOrgId, setCurrentOrgId, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
