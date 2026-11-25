import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import { loginStaff } from "../services/auth";

import {
  clearSession,
  getSession,
  saveSession,
} from "../storage/authStorage";

import type { Session, UserRole } from "../types/auth";

const SCANNER_ROLES: UserRole[] = [
  "EVENT_ADMIN",
  "ORGANIZER",
  "PLATFORM_ADMIN",
];

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
          storedSession &&
          SCANNER_ROLES.includes(storedSession.user.role)
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
      await loginStaff(email, password);

    if (!SCANNER_ROLES.includes(response.user.role)) {
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
