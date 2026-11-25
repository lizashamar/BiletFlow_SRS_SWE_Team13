import * as Crypto from "expo-crypto";

import type { OfflineManifest } from "../types/checkIn";

export type OfflineVerifyResult =
  | "VALID"
  | "INVALID"
  | "ALREADY_CHECKED_IN"
  | "REJECTED";

export async function digestQr(qrToken: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    qrToken
  );
  return digest.toLowerCase();
}

export async function verifyTicketOffline(
  qrToken: string,
  manifest: OfflineManifest
): Promise<{ result: OfflineVerifyResult; attendeeName?: string }> {
  const digest = await digestQr(qrToken);

  const ticket = manifest.tickets.find(
    (item) => item.digest.toLowerCase() === digest
  );

  if (!ticket) {
    return { result: "INVALID" };
  }

  if (ticket.status === "CHECKED_IN") {
    return { result: "ALREADY_CHECKED_IN", attendeeName: ticket.attendeeName };
  }

  if (ticket.status !== "VALID") {
    return { result: "REJECTED", attendeeName: ticket.attendeeName };
  }

  return { result: "VALID", attendeeName: ticket.attendeeName };
}
