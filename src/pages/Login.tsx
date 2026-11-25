import { useState } from "react"
import type { FormEvent } from "react"
import { api, errorText, saveSession } from "../api"
import type { User } from "../api"

type Props = {
  onLoggedIn: (user: User) => void
}

type AuthResponse = { token: string; user: User }

const DEMO_ACCOUNTS = [
  { label: "Attendee", email: "attendee@biletflow.kz" },
  { label: "Organizer", email: "organizer@biletflow.kz" },
  { label: "Gate staff", email: "scanner1@biletflow.kz" },
]

function Login({ onLoggedIn }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<"ATTENDEE" | "ORGANIZER">("ATTENDEE")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data =
        mode === "login"
          ? await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password } })
          : await api<AuthResponse>("/auth/register", { method: "POST", body: { email, password, fullName, role } })
      saveSession(data.token, data.user)
      onLoggedIn(data.user)
    } catch (err) {
      setError(errorText(err, "Could not sign in."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-container narrow">
      <h1>{mode === "login" ? "Sign in" : "Create an account"}</h1>

      <form className="panel" onSubmit={handleSubmit}>
        {mode === "register" && (
          <>
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />

            <label htmlFor="role">I want to</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as "ATTENDEE" | "ORGANIZER")}>
              <option value="ATTENDEE">Buy tickets (attendee)</option>
              <option value="ORGANIZER">Run events (organizer)</option>
            </select>
          </>
        )}

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "register" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {error && <p role="alert" className="error-box">{error}</p>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="muted" style={{ marginTop: 16 }}>
          {mode === "login" ? "No account yet? " : "Already registered? "}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login")
              setError("")
            }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </form>

      {mode === "login" && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Demo accounts</h3>
          <p className="muted">Seeded by <code>npx prisma db seed</code>. Click to fill the email.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} type="button" className="secondary-button" onClick={() => setEmail(a.email)}>
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

export default Login
