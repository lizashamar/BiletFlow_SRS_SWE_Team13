import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  OfflineScan,
} from "../types/checkIn";

const QUEUE_KEY =
  "biletflow.offline-scan-queue";

export async function getOfflineQueue():
  Promise<OfflineScan[]> {
  const value =
    await AsyncStorage.getItem(
      QUEUE_KEY
    );

  if (!value) {
    return [];
  }

  try {
    return JSON.parse(
      value
    ) as OfflineScan[];
  } catch {
    await AsyncStorage.removeItem(
      QUEUE_KEY
    );

    return [];
  }
}

export async function addOfflineScan(
  scan: OfflineScan
): Promise<void> {
  const queue =
    await getOfflineQueue();

  const alreadyQueued =
    queue.some(
      (item) =>
        item.qrToken ===
          scan.qrToken &&
        item.eventId ===
          scan.eventId
    );

  if (alreadyQueued) {
    return;
  }

  const updated = [
    ...queue,
    scan,
  ];

  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(updated)
  );
}

export async function removeFromOfflineQueue(
  synced: OfflineScan[]
): Promise<void> {
  const queue = await getOfflineQueue();

  const remaining = queue.filter(
    (item) =>
      !synced.some(
        (s) =>
          s.qrToken === item.qrToken &&
          s.eventId === item.eventId
      )
  );

  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(remaining)
  );
}
