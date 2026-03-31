import { Shield } from "lucide-react";
import { useState } from "react";
import type { AppRole, AuthUser } from "../App";

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

const ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Full access to all modules" },
  {
    value: "underwriter",
    label: "Underwriter",
    desc: "EOI cases & member review",
  },
  { value: "billing", label: "Billing", desc: "Billing records & invoices" },
  { value: "viewer", label: "Viewer", desc: "Read-only dashboard access" },
];

export function Login({ onLogin }: LoginProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("admin");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onLogin({ name: name.trim(), role });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#F4F7FA" }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #0B2236, #115B6A)",
              }}
            >
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">BenefitsHub</h1>
              <p className="text-xs text-gray-500">Group Insurance Platform</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-name"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Your Name
              </label>
              <input
                id="login-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Select Role
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      role === r.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <div className="text-sm font-semibold">{r.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "#2F80ED" }}
            >
              Sign In to BenefitsHub
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Demo mode — select any role to explore
        </p>
      </div>
    </div>
  );
}
