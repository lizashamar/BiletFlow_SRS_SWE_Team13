import { useState } from "react";

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

import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";

export default function ScannerScreen() {
  const { session, signOut } = useAuth();

  const [permission, requestPermission] =
    useCameraPermissions();

  const [scannedValue, setScannedValue] =
    useState<string | null>(null);

  function handleBarcodeScanned(
    result: BarcodeScanningResult
  ) {
    if (scannedValue) {
      return;
    }

    setScannedValue(result.data);
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
        style={styles.permissionContainer}
        edges={["bottom"]}
      >
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>
            Camera access required
          </Text>

          <Text style={styles.infoText}>
            BiletFlow needs camera access to scan
            ticket QR codes.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={requestPermission}
          >
            <Text style={styles.primaryButtonText}>
              Allow camera access
            </Text>
          </Pressable>

          {!permission.canAskAgain ? (
            <Text style={styles.hint}>
              Camera access is blocked. Enable it
              manually in your device settings.
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
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={
          scannedValue
            ? undefined
            : handleBarcodeScanned
        }
      />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.staffLabel}>
              SIGNED IN AS
            </Text>

            <Text style={styles.staffName}>
              {session?.user.name ??
                session?.user.email}
            </Text>
          </View>

          <Pressable
            style={styles.logoutButton}
            onPress={() => void signOut()}
          >
            <Text style={styles.logoutText}>
              Log out
            </Text>
          </Pressable>
        </View>

        <View style={styles.scanArea}>
          <View style={styles.frame} />

          <Text style={styles.instruction}>
            Align the ticket QR code inside the frame
          </Text>
        </View>

        {scannedValue ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>
              QR scanned
            </Text>

            <Text
              numberOfLines={3}
              style={styles.resultValue}
            >
              {scannedValue}
            </Text>

            <Text style={styles.resultNote}>
              Scanning is paused to prevent duplicate
              scans.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                setScannedValue(null)
              }
            >
              <Text style={styles.primaryButtonText}>
                Scan another ticket
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.readyPill}>
            <Text style={styles.readyText}>
              Ready to scan
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(3,7,18,0.78)",
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
    backgroundColor: "rgba(3,7,18,0.72)",
  },

  readyPill: {
    alignSelf: "center",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: "rgba(6,78,59,0.88)",
  },

  readyText: {
    color: "#d1fae5",
    fontWeight: "800",
  },

  resultCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "rgba(3,7,18,0.94)",
    borderWidth: 1,
    borderColor: "#374151",
  },

  resultLabel: {
    color: "#86efac",
    fontWeight: "800",
  },

  resultValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },

  resultNote: {
    color: "#9ca3af",
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
