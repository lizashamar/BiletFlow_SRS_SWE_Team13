import { useEffect, useState } from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import NetInfo from "@react-native-community/netinfo";

import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";

import {
  getOfflineManifest,
  syncOfflineScans,
  verifyTicketOnline,
} from "../services/checkIn";

import {
  verifyTicketOffline,
} from "../services/offlineVerification";

import {
  getManifest,
  saveManifest,
} from "../storage/manifestStorage";

import {
  addOfflineScan,
  clearOfflineQueue,
  getOfflineQueue,
} from "../storage/offlineScanQueue";

import {
  wasRecentlyScanned,
} from "../storage/scanCache";

import type {
  VerifyStatus,
} from "../types/checkIn";


type ScanUiStatus =
  | VerifyStatus
  | "DUPLICATE"
  | "OFFLINE"
  | "SYNCED"
  | "ERROR"
  | null;


const EVENT_ID = 1;


export default function ScannerScreen() {
  const { session, signOut } = useAuth();

  const [permission, requestPermission] =
    useCameraPermissions();

  const [scannedValue, setScannedValue] =
    useState<string | null>(null);

  const [scanStatus, setScanStatus] =
    useState<ScanUiStatus>(null);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [isOnline, setIsOnline] =
    useState(true);

  const [isManifestAvailable, setIsManifestAvailable] =
    useState(false);

  const [isDownloadingManifest, setIsDownloadingManifest] =
    useState(false);

  const [isSyncing, setIsSyncing] =
    useState(false);

  const [offlineQueueCount, setOfflineQueueCount] =
    useState(0);


  async function refreshOfflineQueueCount() {
    const queue = await getOfflineQueue();

    setOfflineQueueCount(queue.length);
  }


  async function checkStoredManifest() {
    const manifest = await getManifest(EVENT_ID);

    setIsManifestAvailable(Boolean(manifest));
  }


  async function downloadManifest() {
    if (!session?.token) {
      setScanStatus("ERROR");

      setStatusMessage(
        "Authentication session is missing."
      );

      return;
    }

    if (!isOnline) {
      setScanStatus("OFFLINE");

      setStatusMessage(
        "Connect to the internet before downloading the offline manifest."
      );

      return;
    }

    setIsDownloadingManifest(true);

    try {
      const manifest =
        await getOfflineManifest(
          EVENT_ID,
          session.token
        );

      await saveManifest(manifest);

      setIsManifestAvailable(true);

      setScanStatus("SYNCED");

      setStatusMessage(
        `Offline manifest downloaded successfully for event ${EVENT_ID}.`
      );
    } catch (error) {
      setScanStatus("ERROR");

      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to download offline manifest."
      );
    } finally {
      setIsDownloadingManifest(false);
    }
  }


  async function syncQueuedScans() {
    if (!session?.token) {
      return;
    }

    if (!isOnline) {
      return;
    }

    if (isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      const queue =
        await getOfflineQueue();

      if (queue.length === 0) {
        setOfflineQueueCount(0);

        return;
      }

      const batch =
        queue.slice(0, 200);

      await syncOfflineScans(
        batch,
        session.token
      );

      await clearOfflineQueue();

      setOfflineQueueCount(0);

      setScanStatus("SYNCED");

      setStatusMessage(
        `${batch.length} offline scan(s) synchronized successfully.`
      );
    } catch (error) {
      console.log(
        "Offline sync failed:",
        error
      );

      setStatusMessage(
        "Offline scans are still queued and will be synchronized later."
      );
    } finally {
      setIsSyncing(false);
    }
  }


  useEffect(() => {
    void checkStoredManifest();
    void refreshOfflineQueueCount();
  }, []);


  useEffect(() => {
    const unsubscribe =
      NetInfo.addEventListener(
        (state) => {
          const online =
            state.isConnected === true;

          setIsOnline(online);

          if (online) {
            void syncQueuedScans();
          }
        }
      );

    return unsubscribe;
  }, [session?.token]);


  async function handleBarcodeScanned(
    result: BarcodeScanningResult
  ) {
    if (scannedValue) {
      return;
    }

    const qrToken = result.data;

    setScannedValue(qrToken);

    setScanStatus(null);

    setStatusMessage(
      "Processing ticket..."
    );

    try {
      const duplicate =
        await wasRecentlyScanned(
          qrToken
        );

      if (duplicate) {
        setScanStatus(
          "DUPLICATE"
        );

        setStatusMessage(
          "This ticket was already scanned recently on this device."
        );

        return;
      }


      if (isOnline) {
        if (!session?.token) {
          setScanStatus(
            "ERROR"
          );

          setStatusMessage(
            "Authentication session is missing."
          );

          return;
        }

        const response =
          await verifyTicketOnline(
            qrToken,
            EVENT_ID,
            session.token
          );

        setScanStatus(
          response.status
        );

        setStatusMessage(
          response.message ??
            getDefaultStatusMessage(
              response.status
            )
        );

        return;
      }


      const manifest =
        await getManifest(
          EVENT_ID
        );

      if (!manifest) {
        setScanStatus(
          "OFFLINE"
        );

        setStatusMessage(
          "No offline manifest is available. Connect to the internet and download the manifest first."
        );

        return;
      }


      const offlineResult =
        await verifyTicketOffline(
          qrToken,
          manifest
        );


      if (
        offlineResult ===
        "INVALID"
      ) {
        setScanStatus(
          "INVALID"
        );

        setStatusMessage(
          "Ticket was not found in the offline manifest."
        );

        return;
      }


      if (
        offlineResult ===
        "ALREADY_CHECKED_IN"
      ) {
        setScanStatus(
          "ALREADY_CHECKED_IN"
        );

        setStatusMessage(
          "This ticket was already checked in before the manifest was downloaded."
        );

        return;
      }


      await addOfflineScan({
        qrToken,
        eventId: EVENT_ID,
        scannedAt:
          new Date().toISOString(),
      });


      await refreshOfflineQueueCount();


      setScanStatus(
        "OFFLINE"
      );

      setStatusMessage(
        "Ticket accepted offline and added to the synchronization queue."
      );

    } catch (error) {
      setScanStatus(
        "ERROR"
      );

      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to process ticket."
      );
    }
  }


  function resetScanner() {
    setScannedValue(null);

    setScanStatus(null);

    setStatusMessage("");
  }


  function getDefaultStatusMessage(
    status: VerifyStatus
  ) {
    switch (status) {
      case "CHECKED_IN":
        return "Ticket checked in successfully.";

      case "VALID":
        return "Ticket is valid.";

      case "ALREADY_CHECKED_IN":
        return "Ticket has already been checked in.";

      case "REJECTED":
        return "Ticket was rejected.";

      case "INVALID":
        return "Ticket is invalid.";

      case "WRONG_EVENT":
        return "Ticket belongs to a different event.";

      case "TEMPORARY_ERROR":
        return "Temporary verification error.";

      default:
        return "Ticket processed.";
    }
  }


  function getStatusTitle() {
    switch (scanStatus) {
      case "CHECKED_IN":
        return "Checked in";

      case "VALID":
        return "Valid ticket";

      case "ALREADY_CHECKED_IN":
        return "Already checked in";

      case "REJECTED":
        return "Rejected ticket";

      case "INVALID":
        return "Invalid ticket";

      case "WRONG_EVENT":
        return "Wrong event";

      case "TEMPORARY_ERROR":
        return "Temporary error";

      case "DUPLICATE":
        return "Duplicate scan";

      case "OFFLINE":
        return "Offline";

      case "SYNCED":
        return "Synchronization complete";

      case "ERROR":
        return "Error";

      default:
        return "QR scanned";
    }
  }


  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>
          Checking camera permission...
        </Text>
      </View>
    );
  }


  if (!permission.granted) {
    return (
      <SafeAreaView
        style={
          styles.permissionContainer
        }
        edges={["bottom"]}
      >
        <View
          style={
            styles.permissionCard
          }
        >
          <Text
            style={
              styles.permissionTitle
            }
          >
            Camera access required
          </Text>

          <Text
            style={styles.infoText}
          >
            BiletFlow needs camera
            access to scan ticket QR
            codes.
          </Text>

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={
              requestPermission
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Allow camera access
            </Text>
          </Pressable>

          {!permission.canAskAgain ? (
            <Text
              style={styles.hint}
            >
              Camera access is
              blocked. Enable it
              manually in your device
              settings.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }


  return (
    <View style={styles.container}>
      <CameraView
        style={
          StyleSheet.absoluteFill
        }
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={
          scannedValue
            ? undefined
            : handleBarcodeScanned
        }
      />


      <SafeAreaView
        style={styles.overlay}
      >
        <View style={styles.topBar}>
          <View style={styles.staffInfo}>
            <Text
              style={styles.staffLabel}
            >
              SIGNED IN AS
            </Text>

            <Text
              style={styles.staffName}
            >
              {session?.user.name ??
                session?.user.email}
            </Text>

            <Text
              style={
                isOnline
                  ? styles.onlineText
                  : styles.offlineText
              }
            >
              {isOnline
                ? "● Online"
                : "● Offline"}
            </Text>

            <Text
              style={
                styles.queueText
              }
            >
              Offline queue:{" "}
              {offlineQueueCount}
            </Text>
          </View>


          <Pressable
            style={
              styles.logoutButton
            }
            onPress={() =>
              void signOut()
            }
          >
            <Text
              style={
                styles.logoutText
              }
            >
              Log out
            </Text>
          </Pressable>
        </View>


        <View
          style={
            styles.manifestPanel
          }
        >
          <Text
            style={
              styles.manifestStatus
            }
          >
            Offline manifest:{" "}
            {isManifestAvailable
              ? "Available"
              : "Not downloaded"}
          </Text>

          <Pressable
            style={
              styles.smallButton
            }
            disabled={
              isDownloadingManifest ||
              !isOnline
            }
            onPress={() =>
              void downloadManifest()
            }
          >
            <Text
              style={
                styles.smallButtonText
              }
            >
              {isDownloadingManifest
                ? "Downloading..."
                : "Download Offline Manifest"}
            </Text>
          </Pressable>


          {offlineQueueCount > 0 &&
          isOnline ? (
            <Pressable
              style={
                styles.smallButton
              }
              disabled={isSyncing}
              onPress={() =>
                void syncQueuedScans()
              }
            >
              <Text
                style={
                  styles.smallButtonText
                }
              >
                {isSyncing
                  ? "Synchronizing..."
                  : "Sync Offline Scans"}
              </Text>
            </Pressable>
          ) : null}
        </View>


        <View
          style={styles.scanArea}
        >
          <View
            style={styles.frame}
          />

          <Text
            style={
              styles.instruction
            }
          >
            Align the ticket QR code
            inside the frame
          </Text>
        </View>


        {scannedValue ? (
          <View
            style={
              styles.resultCard
            }
          >
            <Text
              style={
                styles.resultLabel
              }
            >
              {getStatusTitle()}
            </Text>

            <Text
              numberOfLines={3}
              style={
                styles.resultValue
              }
            >
              {scannedValue}
            </Text>

            <Text
              style={
                styles.resultNote
              }
            >
              {statusMessage}
            </Text>

            <Pressable
              style={
                styles.primaryButton
              }
              onPress={
                resetScanner
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Scan another ticket
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={
              styles.readyPill
            }
          >
            <Text
              style={
                styles.readyText
              }
            >
              Ready to scan
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}


const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000000",
    },

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

    permissionTitle: {
      color: "#ffffff",
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 10,
    },

    infoText: {
      color: "#d1d5db",
      fontSize: 16,
      lineHeight: 23,
      textAlign: "center",
    },

    hint: {
      color: "#9ca3af",
      marginTop: 14,
    },

    overlay: {
      flex: 1,
      justifyContent:
        "space-between",
      padding: 20,
      backgroundColor:
        "rgba(0,0,0,0.18)",
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      padding: 14,
      borderRadius: 16,
      backgroundColor:
        "rgba(3,7,18,0.82)",
    },

    staffInfo: {
      flex: 1,
      paddingRight: 10,
    },

    staffLabel: {
      color: "#93c5fd",
      fontSize: 11,
      fontWeight: "800",
    },

    staffName: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
      marginTop: 3,
    },

    onlineText: {
      color: "#86efac",
      marginTop: 5,
      fontSize: 12,
      fontWeight: "700",
    },

    offlineText: {
      color: "#fca5a5",
      marginTop: 5,
      fontSize: 12,
      fontWeight: "700",
    },

    queueText: {
      color: "#d1d5db",
      marginTop: 3,
      fontSize: 12,
    },

    logoutButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#4b5563",
    },

    logoutText: {
      color: "#ffffff",
      fontWeight: "700",
    },

    manifestPanel: {
      backgroundColor:
        "rgba(3,7,18,0.88)",
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: "#374151",
    },

    manifestStatus: {
      color: "#ffffff",
      fontWeight: "700",
      marginBottom: 8,
    },

    smallButton: {
      backgroundColor: "#1d4ed8",
      minHeight: 40,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
      borderRadius: 10,
      marginTop: 6,
    },

    smallButtonText: {
      color: "#ffffff",
      fontWeight: "700",
    },

    scanArea: {
      alignItems: "center",
    },

    frame: {
      width: 260,
      height: 260,
      borderWidth: 4,
      borderColor: "#ffffff",
      borderRadius: 20,
    },

    instruction: {
      color: "#ffffff",
      fontWeight: "700",
      marginTop: 18,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor:
        "rgba(3,7,18,0.72)",
    },

    readyPill: {
      alignSelf: "center",
      borderRadius: 999,
      paddingVertical: 11,
      paddingHorizontal: 18,
      backgroundColor:
        "rgba(6,78,59,0.88)",
    },

    readyText: {
      color: "#d1fae5",
      fontWeight: "800",
    },

    resultCard: {
      borderRadius: 18,
      padding: 18,
      backgroundColor:
        "rgba(3,7,18,0.94)",
      borderWidth: 1,
      borderColor: "#374151",
    },

    resultLabel: {
      color: "#86efac",
      fontWeight: "800",
      fontSize: 18,
    },

    resultValue: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
      marginTop: 8,
    },

    resultNote: {
      color: "#d1d5db",
      marginTop: 8,
      marginBottom: 14,
    },

    primaryButton: {
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: "#2563eb",
      marginTop: 18,
    },

    primaryButtonText: {
      color: "#ffffff",
      fontWeight: "800",
      fontSize: 16,
    },
  });
