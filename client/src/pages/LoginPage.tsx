import type { FormEvent } from "react";
import { useEffect, useState } from "react";

export const LoginPage: React.FC = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const [email, setEmail] = useState<string>("demo@example.com");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get("token");
    const errorFromUrl = url.searchParams.get("error");

    if (errorFromUrl) {
      setError(
        errorFromUrl === "account_blocked"
          ? "Your account has been blocked by an administrator."
          : `Social login failed: ${errorFromUrl}`,
      );
      url.searchParams.delete("error");
      window.history.replaceState({}, document.title, url.pathname + url.search);
      return;
    }

    if (tokenFromUrl) {
      const handleSocialLogin = async () => {
        try {
          setLoading(true);
          setError(null);
          setInfo(null);

          const response = await fetch(`${apiBase}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${tokenFromUrl}`,
            },
          });

          if (!response.ok) {
            setError("Failed to fetch user info for social login.");
            return;
          }

          const user = await response.json();
          window.localStorage.setItem("authToken", tokenFromUrl);
          window.localStorage.setItem("authUser", JSON.stringify(user));

          url.searchParams.delete("token");
          window.history.replaceState({}, document.title, url.pathname + url.search);

          window.location.href = "/";
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(err);
          setError("Social login processing failed.");
        } finally {
          setLoading(false);
        }
      };

      void handleSocialLogin();
    }
  }, [apiBase]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setInfo(null);

      const endpoint =
        mode === "login" ? `${apiBase}/api/auth/login` : `${apiBase}/api/auth/register`;

      const payload =
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              name: name || undefined,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.message ?? `Request failed with status ${response.status}`);
        return;
      }

      if (data.token) {
        window.localStorage.setItem("authToken", data.token);
        window.localStorage.setItem("authUser", JSON.stringify(data.user));
      }

      setInfo(mode === "login" ? "Logged in successfully." : "Registered successfully.");
      window.location.href = "/";
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError("Authentication request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <section className="mb-3">
        <h1 className="h4 mb-1">Authentication</h1>
        <p className="text-muted mb-0">
          Simple email/password auth. Token is stored in localStorage under <code>authToken</code>.
        </p>
      </section>

      <div className="bg-white rounded-3 shadow-sm p-3">
        <div className="btn-group btn-group-sm mb-3" role="group">
          <button
            type="button"
            className={`btn btn-outline-primary ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`btn btn-outline-primary ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        {error && (
          <p className="text-danger mb-2" data-testid="auth-error">
            {error}
          </p>
        )}
        {info && (
          <p className="text-success mb-2" data-testid="auth-info">
            {info}
          </p>
        )}

        <div className="mb-3">
          <p className="text-muted small mb-2">Or sign in with a social account:</p>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={async () => {
                try {
                  setError(null);
                  const response = await fetch(`${apiBase}/api/auth/google/url`);
                  if (!response.ok) {
                    throw new Error(`Failed to start Google login: ${response.status}`);
                  }
                  const data = (await response.json()) as { url: string };
                  window.location.href = data.url;
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error(err);
                  setError("Failed to start Google login.");
                }
              }}
              disabled={loading}
            >
              Continue with Google
            </button>
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={async () => {
                try {
                  setError(null);
                  const response = await fetch(`${apiBase}/api/auth/github/url`);
                  if (!response.ok) {
                    throw new Error(`Failed to start GitHub login: ${response.status}`);
                  }
                  const data = (await response.json()) as { url: string };
                  window.location.href = data.url;
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error(err);
                  setError("Failed to start GitHub login.");
                }
              }}
              disabled={loading}
            >
              Continue with GitHub
            </button>
          </div>
        </div>

        <form className="row g-3" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="col-12">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          <div className="col-12">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="col-12">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="col-12 d-flex justify-content-end">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

