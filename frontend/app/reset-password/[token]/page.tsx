"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const params = useParams();
  const token = String(params.token);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.confirmPasswordReset(token, password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.message);
          setError(body.detail ?? err.message);
        } catch {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please request a new reset link.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7fbff] px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/app" className="inline-flex items-center gap-3 font-semibold text-ink">
          <span className="grid size-9 place-items-center rounded-md bg-skybrand text-white">S</span>
          SoloRMT
        </Link>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">Set a new password</h1>

          {success ? (
            <div className="mt-5 grid gap-4">
              <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                Password updated successfully.
              </p>
              <Link href="/app" className="primary-button block text-center">
                Go to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="input"
                  placeholder="At least 8 characters"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Confirm password
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="input"
                />
              </label>

              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              ) : null}

              <button className="primary-button w-full" disabled={loading}>
                {loading ? "Saving…" : "Set New Password"}
              </button>

              <Link href="/app" className="text-center text-sm text-skybrand hover:underline">
                Back to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
