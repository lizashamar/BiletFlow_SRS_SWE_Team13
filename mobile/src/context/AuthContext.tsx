import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import { loginEventAdmin } from "../services/auth";

import {
  clearSession,
  getSession,
  saveSession,
} from "../storage/authStorage";

import type { Session } from "../types/auth";

type AuthContextValue = {
  session: Session | null;
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [isRestoring, setIsRestoring] =
    useState(true);

  useEffect(() => {
    getSession()
      .then((storedSession) => {
        if (
          storedSession?.user.role === "EVENT_ADMIN"
        ) {
          setSession(storedSession);
        }
      })
      .finally(() => {
        setIsRestoring(false);
      });
  }, []);

  async function signIn(
    email: string,
    password: string
  ) {
    const response =
      await loginEventAdmin(email, password);

    if (response.user.role !== "EVENT_ADMIN") {
      throw new Error(
        "This account is not authorized for ticket scanning."
      );
    }

    const nextSession: Session = {
      token: response.token,
      user: response.user,
    };

    await saveSession(nextSession);

    setSession(nextSession);
  }

  async function signOut() {
    await clearSession();
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isRestoring,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
