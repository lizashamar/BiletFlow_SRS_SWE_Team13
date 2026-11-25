import { apiRequest } from "./api";
import type { LoginResponse } from "../types/auth";

export async function loginStaff(
  email: string,
  password: string
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });
}
