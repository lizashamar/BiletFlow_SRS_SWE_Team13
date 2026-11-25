import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  OfflineManifest,
} from "../types/checkIn";

function getManifestKey(eventId: number) {
  return `biletflow.manifest.${eventId}`;
}

export async function saveManifest(
  manifest: OfflineManifest
): Promise<void> {
  await AsyncStorage.setItem(
    getManifestKey(manifest.eventId),
    JSON.stringify(manifest)
  );
}

export async function markCheckedInLocally(
  eventId: number,
  digest: string
): Promise<void> {
  const manifest = await getManifest(eventId);

  if (!manifest) {
    return;
  }

  await saveManifest({
    ...manifest,
    tickets: manifest.tickets.map((t) =>
      t.digest.toLowerCase() === digest
        ? { ...t, status: "CHECKED_IN" }
        : t
    ),
  });
}

export async function getManifest(
  eventId: number
): Promise<OfflineManifest | null> {
  const value = await AsyncStorage.getItem(
    getManifestKey(eventId)
  );

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as OfflineManifest;
  } catch {
    await AsyncStorage.removeItem(
      getManifestKey(eventId)
    );

    return null;
  }
}
