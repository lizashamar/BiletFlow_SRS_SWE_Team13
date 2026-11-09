import * as SecureStore from "expo-secure-store";
import type { Session } from "../types/auth";

const SESSION_KEY = "biletflow.event-admin.session";

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(
    SESSION_KEY,
    JSON.stringify(session)
  );
}

export async function getSession(): Promise<Session | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
