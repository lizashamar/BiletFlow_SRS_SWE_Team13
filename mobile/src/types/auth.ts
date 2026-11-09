export type UserRole =
  | "ATTENDEE"
  | "ORGANIZER"
  | "EVENT_ADMIN"
  | "PLATFORM_ADMIN";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type LoginResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

export type Session = {
  token: string;
  user: AuthUser;
};
