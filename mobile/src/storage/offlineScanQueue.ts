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

export async function clearOfflineQueue():
  Promise<void> {
  await AsyncStorage.removeItem(
    QUEUE_KEY
  );
}
