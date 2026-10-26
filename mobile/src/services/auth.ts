import { apiRequest } from "./api";
import type { LoginResponse } from "../types/auth";

export async function loginEventAdmin(
  email: string,
  password: string
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/event-admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });
}
