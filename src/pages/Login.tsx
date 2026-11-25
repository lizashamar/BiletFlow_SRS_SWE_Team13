import { useState } from "react"
import type { FormEvent } from "react"
import Icon from "../components/Icon"
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
    <main className="auth-layout">
      <aside className="auth-side">
        <div className="cover-pattern" />
        <span className="brand" style={{ color: "white", position: "relative" }}>
          <span className="brand-mark" style={{ background: "white", color: "#0b0b12" }}>
            <Icon name="ticket" size={20} />
          </span>
          BiletFlow
        </span>
        <div style={{ position: "relative" }}>
          <h2>Tickets in a tap. Entry in a scan.</h2>
          <p>Buy tickets for events across Kazakhstan, keep them in your wallet, and walk in with a QR code.</p>
        </div>
        <p style={{ position: "relative", fontSize: 13 }}>CSCI 361 · Team 13</p>
      </aside>

      <section className="auth-form">
        <p className="eyebrow">{mode === "login" ? "Welcome back" : "Get started"}</p>
        <h1>{mode === "login" ? "Sign in" : "Create an account"}</h1>

        <form className="panel" onSubmit={handleSubmit} style={{ marginTop: 8 }}>
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

          <button type="submit" className="primary-button block" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
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
          <div className="sub-panel" style={{ marginTop: 24, paddingTop: 14 }}>
            <strong style={{ fontSize: 14 }}>Demo accounts</strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>Click to fill the email.</p>
            <div className="demo-accounts">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} type="button" className="chip" onClick={() => setEmail(a.email)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default Login
