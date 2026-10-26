import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  CachedScan,
  CheckInStatus,
} from "../types/checkIn";

const CACHE_KEY = "biletflow.recent-ticket-scans";

const MAX_CACHE_SIZE = 200;

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

async function getAllScans(): Promise<CachedScan[]> {
  const value = await AsyncStorage.getItem(CACHE_KEY);

  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as CachedScan[];
  } catch {
    await AsyncStorage.removeItem(CACHE_KEY);
    return [];
  }
}

export async function cacheScan(
  qrToken: string,
  status: CheckInStatus | "OFFLINE"
): Promise<void> {
  const scans = await getAllScans();

  const newScan: CachedScan = {
    qrToken,
    scannedAt: new Date().toISOString(),
    status,
  };

  const updated = [
    newScan,
    ...scans.filter(
      (scan) => scan.qrToken !== qrToken
    ),
  ].slice(0, MAX_CACHE_SIZE);

  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify(updated)
  );
}

export async function wasRecentlyScanned(
  qrToken: string
): Promise<boolean> {
  const scans = await getAllScans();

  const scan = scans.find(
    (item) => item.qrToken === qrToken
  );

  if (!scan) {
    return false;
  }

  const scannedAt = new Date(scan.scannedAt).getTime();

  return Date.now() - scannedAt < DUPLICATE_WINDOW_MS;
}

export async function clearOldScans(): Promise<void> {
  const scans = await getAllScans();

  const freshScans = scans.filter((scan) => {
    const scannedAt = new Date(scan.scannedAt).getTime();

    return Date.now() - scannedAt < DUPLICATE_WINDOW_MS;
  });

  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify(freshScans)
  );
}
