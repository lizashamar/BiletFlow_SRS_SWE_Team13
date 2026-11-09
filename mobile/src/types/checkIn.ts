export type VerifyStatus =
  | "CHECKED_IN"
  | "VALID"
  | "ALREADY_CHECKED_IN"
  | "REJECTED"
  | "INVALID"
  | "WRONG_EVENT"
  | "TEMPORARY_ERROR";

export type VerifyResponse = {
  status: VerifyStatus;
  message?: string;

  ticket?: {
    id?: number;
    attendeeName?: string;
  };
};

export type ManifestTicket = {
  digest: string;
  status: string;
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
  status: string;
  message?: string;
};

export type SyncResponse = {
  results: SyncScanResult[];
};
