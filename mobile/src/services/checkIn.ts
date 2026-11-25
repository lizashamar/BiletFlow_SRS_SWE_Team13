import { apiRequest } from "./api";

import type {
  OfflineManifest,
  OfflineScan,
  ScannerEvent,
  SyncResponse,
  VerifyResponse,
} from "../types/checkIn";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export function getScannerEvents(authToken: string): Promise<ScannerEvent[]> {
  return apiRequest<ScannerEvent[]>("/api/checkin/events", {
    headers: auth(authToken),
  });
}

export async function getOfflineManifest(
  eventId: number,
  authToken: string
): Promise<OfflineManifest> {
  const response = await apiRequest<{
    tickets: { h: string; s: string; n: string }[];
  }>(`/api/checkin/manifest/${eventId}`, {
    headers: auth(authToken),
  });

  return {
    eventId,
    tickets: response.tickets.map((t) => ({
      digest: t.h,
      status: t.s,
      attendeeName: t.n,
    })),
    downloadedAt: new Date().toISOString(),
  };
}

export async function verifyTicketOnline(
  qrToken: string,
  eventId: number,
  authToken: string
): Promise<VerifyResponse> {
  const response = await apiRequest<{
    status: "VALID" | "INVALID" | "ALREADY_CHECKED_IN" | "CANCELLED";
    message?: string;
    ticket?: VerifyResponse["ticket"];
  }>("/api/tickets/check-in", {
    method: "POST",
    headers: auth(authToken),
    body: JSON.stringify({ qrToken, eventId }),
  });

  const status =
    response.status === "VALID"
      ? "CHECKED_IN"
      : response.status === "CANCELLED"
        ? "REJECTED"
        : response.status;

  return { status, message: response.message, ticket: response.ticket };
}

export function syncOfflineScans(
  eventId: number,
  scans: OfflineScan[],
  authToken: string
): Promise<SyncResponse> {
  return apiRequest<SyncResponse>("/api/checkin/sync", {
    method: "POST",
    headers: auth(authToken),
    body: JSON.stringify({
      eventId,
      scans: scans.map((s) => ({
        qrCodeHash: s.qrToken,
        scannedAt: s.scannedAt,
      })),
    }),
  });
}
