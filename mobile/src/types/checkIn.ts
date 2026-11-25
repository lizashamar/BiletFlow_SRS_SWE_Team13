export type VerifyStatus =
  | "CHECKED_IN"
  | "ALREADY_CHECKED_IN"
  | "REJECTED"
  | "INVALID";

export type VerifyResponse = {
  status: VerifyStatus;
  message?: string;
  ticket?: {
    id?: number;
    attendeeName?: string;
    eventName?: string;
  };
};

export type ScannerEvent = {
  id: number;
  title: string;
  venueName: string;
  startTime: string;
};

export type ManifestTicket = {
  digest: string;
  status: string;
  attendeeName?: string;
};

export type OfflineManifest = {
  eventId: number;
  tickets: ManifestTicket[];
  downloadedAt: string;
};

export type OfflineScan = {
  qrToken: string;
  eventId: number;
  scannedAt: string;
};

export type SyncScanResult = {
  status: "CHECKED_IN" | "ALREADY_CHECKED_IN" | "REJECTED" | "ERROR";
  reason?: string;
};

export type SyncResponse = {
  results: SyncScanResult[];
  summary: Record<string, number>;
};
