import { apiRequest } from "./api";
import type { CheckInResponse } from "../types/checkIn";

export async function verifyAndCheckInTicket(
  qrToken: string,
  authToken: string
): Promise<CheckInResponse> {
  return apiRequest<CheckInResponse>(
    "/api/tickets/check-in",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${authToken}`,
      },

      body: JSON.stringify({
        qrToken,
      }),
    }
  );
}
