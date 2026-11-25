import { useCallback, useEffect, useRef, useState } from "react";

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { NetworkError } from "../services/api";

import {
  getOfflineManifest,
  getScannerEvents,
  syncOfflineScans,
  verifyTicketOnline,
} from "../services/checkIn";

import {
  digestQr,
  verifyTicketOffline,
} from "../services/offlineVerification";

import {
  getManifest,
  markCheckedInLocally,
  saveManifest,
} from "../storage/manifestStorage";

import {
  addOfflineScan,
  getOfflineQueue,
  removeFromOfflineQueue,
} from "../storage/offlineScanQueue";

import {
  cacheScan,
  wasRecentlyScanned,
} from "../storage/scanCache";

import type {
  OfflineScan,
  ScannerEvent,
  VerifyStatus,
} from "../types/checkIn";

type ScanUiStatus =
  | VerifyStatus
  | "DUPLICATE"
  | "OFFLINE"
  | "SYNCED"
  | "ERROR"
  | null;

const EVENTS_KEY = "biletflow.scanner-events";
const SELECTED_EVENT_KEY = "biletflow.selected-event";

const STATUS_TITLE: Record<Exclude<ScanUiStatus, null>, string> = {
  CHECKED_IN: "Admitted",
  ALREADY_CHECKED_IN: "Already checked in",
  REJECTED: "Rejected",
  INVALID: "Invalid ticket",
  DUPLICATE: "Duplicate scan",
  OFFLINE: "Accepted offline",
  SYNCED: "Synchronized",
  ERROR: "Error",
};

const STATUS_MESSAGE: Record<VerifyStatus, string> = {
  CHECKED_IN: "Ticket checked in successfully.",
  ALREADY_CHECKED_IN: "This ticket has already been used. Entry rejected.",
  REJECTED: "Ticket is not valid for entry.",
  INVALID: "Unknown QR code.",
};

const isSuccess = (s: ScanUiStatus) =>
  s === "CHECKED_IN" || s === "OFFLINE" || s === "SYNCED";

export default function ScannerScreen() {
  const { session, signOut } = useAuth();
  const token = session?.token ?? "";

  const [permission, requestPermission] = useCameraPermissions();

  const [events, setEvents] = useState<ScannerEvent[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);

  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanUiStatus>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const [isOnline, setIsOnline] = useState(true);
  const [isManifestAvailable, setIsManifestAvailable] = useState(false);
  const [isDownloadingManifest, setIsDownloadingManifest] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const syncingRef = useRef(false);
  // camera fires several callbacks per QR before state updates; lock synchronously
  const scanLockRef = useRef(false);

  const selectedEvent = events.find((e) => e.id === eventId);

  const refreshOfflineQueueCount = useCallback(async () => {
    setOfflineQueueCount((await getOfflineQueue()).length);
  }, []);

  const loadEvents = useCallback(async () => {
    let list: ScannerEvent[] = [];

    try {
      list = await getScannerEvents(token);
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(list));
    } catch {
      const cached = await AsyncStorage.getItem(EVENTS_KEY);
      list = cached ? (JSON.parse(cached) as ScannerEvent[]) : [];
    }

    setEvents(list);

    const saved = Number(await AsyncStorage.getItem(SELECTED_EVENT_KEY));
    const initial = list.find((e) => e.id === saved) ?? list[0];
    setEventId(initial ? initial.id : null);
  }, [token]);

  async function selectEvent(id: number) {
    setEventId(id);
    await AsyncStorage.setItem(SELECTED_EVENT_KEY, String(id));
  }

  async function downloadManifest() {
    if (eventId === null) {
      return;
    }

    setIsDownloadingManifest(true);

    try {
      const manifest = await getOfflineManifest(eventId, token);
      await saveManifest(manifest);
      setIsManifestAvailable(true);
      setScanStatus("SYNCED");
      setStatusMessage(
        `Offline manifest saved: ${manifest.tickets.length} ticket(s) for "${selectedEvent?.title ?? eventId}".`
      );
    } catch (error) {
      setScanStatus("ERROR");
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to download offline manifest."
      );
    } finally {
      setIsDownloadingManifest(false);
    }
  }

  const syncQueuedScans = useCallback(async () => {
    if (!token || syncingRef.current) {
      return;
    }

    const queue = await getOfflineQueue();

    if (queue.length === 0) {
      setOfflineQueueCount(0);
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const byEvent = new Map<number, OfflineScan[]>();
      for (const scan of queue) {
        byEvent.set(scan.eventId, [...(byEvent.get(scan.eventId) ?? []), scan]);
      }

      let admitted = 0;
      let rejected = 0;

      for (const [id, scans] of byEvent) {
        const batch = scans.slice(0, 200);
        const response = await syncOfflineScans(id, batch, token);

        const done = batch.filter((_, i) => response.results[i]?.status !== "ERROR");
        await removeFromOfflineQueue(done);

        admitted += response.summary.CHECKED_IN ?? 0;
        rejected += (response.summary.ALREADY_CHECKED_IN ?? 0) + (response.summary.REJECTED ?? 0);
      }

      setScanStatus("SYNCED");
      setStatusMessage(
        `Offline scans synchronized: ${admitted} admitted, ${rejected} rejected by the server.`
      );
    } catch (error) {
      setScanStatus("ERROR");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Offline scans are still queued and will be synchronized later."
      );
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshOfflineQueueCount();
    }
  }, [token, refreshOfflineQueueCount]);

  useEffect(() => {
    void loadEvents();
    void refreshOfflineQueueCount();
  }, [loadEvents, refreshOfflineQueueCount]);

  useEffect(() => {
    if (eventId === null) {
      setIsManifestAvailable(false);
      return;
    }
    getManifest(eventId).then((m) => setIsManifestAvailable(Boolean(m)));
  }, [eventId]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true;
      setIsOnline(online);
      if (online) {
        void syncQueuedScans();
      }
    });

    return unsubscribe;
  }, [syncQueuedScans]);

  async function verifyOffline(qrToken: string, id: number) {
    const manifest = await getManifest(id);

    if (!manifest) {
      setScanStatus("ERROR");
      setStatusMessage(
        "No connection and no offline manifest for this event. Download the manifest while online."
      );
      return;
    }

    const { result, attendeeName } = await verifyTicketOffline(qrToken, manifest);

    if (result !== "VALID") {
      setScanStatus(result);
      setStatusMessage(
        result === "ALREADY_CHECKED_IN"
          ? `${attendeeName ?? "Ticket"} was already checked in.`
          : result === "REJECTED"
            ? "Ticket was cancelled or refunded."
            : "Ticket was not found in the offline manifest."
      );
      return;
    }

    await addOfflineScan({ qrToken, eventId: id, scannedAt: new Date().toISOString() });
    await markCheckedInLocally(id, await digestQr(qrToken));
    await cacheScan(qrToken, "OFFLINE");
    await refreshOfflineQueueCount();

    setScanStatus("OFFLINE");
    setStatusMessage(
      `${attendeeName ?? "Ticket"} admitted offline. It will be confirmed with the server when the connection returns.`
    );
  }

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scanLockRef.current || eventId === null) {
      return;
    }
    scanLockRef.current = true;

    const qrToken = result.data.trim();

    setScannedValue(qrToken);
    setScanStatus(null);
    setStatusMessage("Processing ticket...");

    try {
      if (!isOnline) {
        if (await wasRecentlyScanned(qrToken)) {
          setScanStatus("DUPLICATE");
          setStatusMessage("This ticket was already scanned on this device.");
          return;
        }
        await verifyOffline(qrToken, eventId);
        return;
      }

      try {
        const response = await verifyTicketOnline(qrToken, eventId, token);
        await cacheScan(qrToken, response.status);

        setScanStatus(response.status);
        const name = response.ticket?.attendeeName;
        setStatusMessage(
          response.status === "CHECKED_IN" && name
            ? `${name} — welcome!`
            : response.message ?? STATUS_MESSAGE[response.status]
        );
      } catch (error) {
        if (error instanceof NetworkError) {
          await verifyOffline(qrToken, eventId);
          return;
        }
        throw error;
      }
    } catch (error) {
      setScanStatus("ERROR");
      setStatusMessage(error instanceof Error ? error.message : "Unable to process ticket.");
    }
  }

  function resetScanner() {
    setScannedValue(null);
    setScanStatus(null);
    setStatusMessage("");
    setTimeout(() => {
      scanLockRef.current = false;
    }, 800);
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer} edges={["bottom"]}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access required</Text>
          <Text style={styles.infoText}>
            BiletFlow needs camera access to scan ticket QR codes.
          </Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow camera access</Text>
          </Pressable>
          {!permission.canAskAgain ? (
            <Text style={styles.hint}>
              Camera access is blocked. Enable it manually in your device settings.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scannedValue || eventId === null ? undefined : handleBarcodeScanned}
      />

      <SafeAreaView style={styles.overlay}>
        <View>
          <View style={styles.topBar}>
            <View style={styles.staffInfo}>
              <Text style={styles.staffLabel}>SIGNED IN AS</Text>
              <Text style={styles.staffName}>{session?.user.name ?? session?.user.email}</Text>
              <Text style={isOnline ? styles.onlineText : styles.offlineText}>
                {isOnline ? "● Online" : "● Offline"} · queue: {offlineQueueCount}
              </Text>
            </View>
            <Pressable style={styles.logoutButton} onPress={() => void signOut()}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>

          <View style={styles.manifestPanel}>
            <Text style={styles.manifestStatus}>Event</Text>
            {events.length === 0 ? (
              <Pressable style={styles.smallButton} onPress={() => void loadEvents()}>
                <Text style={styles.smallButtonText}>No events loaded — tap to retry</Text>
              </Pressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {events.map((e) => (
                  <Pressable
                    key={e.id}
                    style={[styles.chip, e.id === eventId && styles.chipActive]}
                    onPress={() => void selectEvent(e.id)}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {e.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text style={styles.manifestHint}>
              Offline manifest: {isManifestAvailable ? "saved" : "not downloaded"}
            </Text>

            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.smallButton, styles.flex]}
                disabled={isDownloadingManifest || !isOnline || eventId === null}
                onPress={() => void downloadManifest()}
              >
                <Text style={styles.smallButtonText}>
                  {isDownloadingManifest ? "Downloading..." : "Download manifest"}
                </Text>
              </Pressable>

              {offlineQueueCount > 0 && isOnline ? (
                <Pressable
                  style={[styles.smallButton, styles.flex]}
                  disabled={isSyncing}
                  onPress={() => void syncQueuedScans()}
                >
                  <Text style={styles.smallButtonText}>
                    {isSyncing ? "Syncing..." : `Sync ${offlineQueueCount} scan(s)`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {!scannedValue ? (
          <View style={styles.scanArea}>
            <View style={styles.frame} />
            <Text style={styles.instruction}>
              {eventId === null ? "Select an event first" : "Align the ticket QR code inside the frame"}
            </Text>
          </View>
        ) : null}

        {scannedValue ? (
          <View style={[styles.resultCard, isSuccess(scanStatus) ? styles.resultOk : scanStatus ? styles.resultBad : null]}>
            <Text style={[styles.resultLabel, !isSuccess(scanStatus) && scanStatus ? styles.resultLabelBad : null]}>
              {scanStatus ? STATUS_TITLE[scanStatus] : "Checking..."}
            </Text>
            <Text style={styles.resultNote}>{statusMessage}</Text>
            <Text numberOfLines={1} style={styles.resultValue}>
              {scannedValue}
            </Text>
            <Pressable style={styles.primaryButton} onPress={resetScanner}>
              <Text style={styles.primaryButtonText}>Scan another ticket</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.readyPill}>
            <Text style={styles.readyText}>
              {selectedEvent ? `Ready · ${selectedEvent.title}` : "Ready to scan"}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030712",
    padding: 24,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#030712",
  },
  permissionCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
  },
  permissionTitle: { color: "#ffffff", fontSize: 24, fontWeight: "800", marginBottom: 10 },
  infoText: { color: "#d1d5db", fontSize: 16, lineHeight: 23, textAlign: "center" },
  hint: { color: "#9ca3af", marginTop: 14 },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(3,7,18,0.82)",
  },
  staffInfo: { flex: 1, paddingRight: 10 },
  staffLabel: { color: "#93c5fd", fontSize: 11, fontWeight: "800" },
  staffName: { color: "#ffffff", fontSize: 15, fontWeight: "700", marginTop: 3 },
  onlineText: { color: "#86efac", marginTop: 5, fontSize: 12, fontWeight: "700" },
  offlineText: { color: "#fca5a5", marginTop: 5, fontSize: 12, fontWeight: "700" },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  logoutText: { color: "#ffffff", fontWeight: "700" },
  manifestPanel: {
    marginTop: 10,
    backgroundColor: "rgba(3,7,18,0.88)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  manifestStatus: { color: "#ffffff", fontWeight: "700", marginBottom: 8 },
  manifestHint: { color: "#9ca3af", fontSize: 12, marginTop: 10 },
  chip: {
    maxWidth: 220,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#ffffff", fontWeight: "700" },
  buttonRow: { flexDirection: "row", gap: 8 },
  smallButton: {
    backgroundColor: "#1d4ed8",
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  smallButtonText: { color: "#ffffff", fontWeight: "700" },
  scanArea: { alignItems: "center" },
  frame: { width: 240, height: 240, borderWidth: 4, borderColor: "#ffffff", borderRadius: 20 },
  instruction: {
    color: "#ffffff",
    fontWeight: "700",
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(3,7,18,0.72)",
  },
  readyPill: {
    alignSelf: "center",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: "rgba(6,78,59,0.88)",
  },
  readyText: { color: "#d1fae5", fontWeight: "800" },
  resultCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "rgba(3,7,18,0.94)",
    borderWidth: 2,
    borderColor: "#374151",
  },
  resultOk: { borderColor: "#22c55e" },
  resultBad: { borderColor: "#ef4444" },
  resultLabel: { color: "#86efac", fontWeight: "800", fontSize: 22 },
  resultLabelBad: { color: "#fca5a5" },
  resultValue: { color: "#6b7280", fontSize: 12, marginTop: 6 },
  resultNote: { color: "#e5e7eb", fontSize: 16, marginTop: 8 },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#2563eb",
    marginTop: 18,
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
});
