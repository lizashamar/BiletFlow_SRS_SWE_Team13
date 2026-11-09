import { apiRequest } from "./api";

import type {
  OfflineManifest,
  OfflineScan,
  SyncResponse,
  VerifyResponse,
} from "../types/checkIn";

export async function getOfflineManifest(
  eventId: number,
  authToken: string
): Promise<OfflineManifest> {
  const response = await apiRequest<{
    eventId?: number;
    tickets: {
      digest: string;
      status: string;
    }[];
  }>(
    `/api/checkin/manifest/${eventId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  return {
    eventId,
    tickets: response.tickets,
    downloadedAt: new Date().toISOString(),
  };
}

export async function verifyTicketOnline(
  qrToken: string,
  eventId: number,
  authToken: string
): Promise<VerifyResponse> {
  return apiRequest<VerifyResponse>(
    "/api/checkin/verify",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        qrToken,
        eventId,
      }),
    }
  );
}

export async function syncOfflineScans(
  scans: OfflineScan[],
  authToken: string
): Promise<SyncResponse> {
  return apiRequest<SyncResponse>(
    "/api/checkin/sync",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        scans,
      }),
    }
  );
}
