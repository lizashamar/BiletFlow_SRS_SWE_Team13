import * as Crypto from "expo-crypto";

import type {
  OfflineManifest,
} from "../types/checkIn";

export type OfflineVerifyResult =
  | "VALID"
  | "INVALID"
  | "ALREADY_CHECKED_IN";

export async function verifyTicketOffline(
  qrToken: string,
  manifest: OfflineManifest
): Promise<OfflineVerifyResult> {
  const digest =
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      qrToken
    );

  const ticket = manifest.tickets.find(
    (item) =>
      item.digest.toLowerCase() ===
      digest.toLowerCase()
  );

  if (!ticket) {
    return "INVALID";
  }

  if (
    ticket.status === "CHECKED_IN" ||
    ticket.status === "USED"
  ) {
    return "ALREADY_CHECKED_IN";
  }

  return "VALID";
}
