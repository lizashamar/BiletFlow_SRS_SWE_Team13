export type CheckInStatus =
  | "VALID"
  | "INVALID"
  | "ALREADY_CHECKED_IN"
  | "CANCELLED";

export type CheckInResponse = {
  status: CheckInStatus;
  message: string;

  ticket?: {
    id: number;
    attendeeName?: string;
    eventName?: string;
  };
};

export type CachedScan = {
  qrToken: string;
  scannedAt: string;
  status: CheckInStatus | "OFFLINE";
};
