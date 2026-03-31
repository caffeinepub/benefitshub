import { AlertTriangle, CheckCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "../App";
import type {
  Enrollment as EnrollmentType,
  InsurancePlan,
  Member,
} from "../backend.d";
import { backend } from "../lib/backend";
import {
  PageHeader,
  PageWrapper,
  Spinner,
  StatusBadge,
  formatCurrency,
} from "./shared";

export function Enrollment({ user }: { user: AuthUser }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [enrollModal, setEnrollModal] = useState<InsurancePlan | null>(null);
  const [coverageAmount, setCoverageAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const canEdit = user.role === "admin" || user.role === "underwriter";

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [m, p, e] = await Promise.all([
        backend.getAllMembers(),
        backend.getAllPlans(),
        backend.getAllEnrollments(),
      ]);
      setMembers(m);
      setPlans(p.filter((p) => p.status === "active"));
      setEnrollments(e);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleEnroll() {
    if (!selectedMember || !enrollModal) return;
    setSaving(true);
    try {
      const amount = Number(coverageAmount);
      await backend.enrollMember(
        BigInt(selectedMember),
        enrollModal.id,
        amount,
        new Date().toISOString().split("T")[0],
      );
      const eoiTriggered = amount > enrollModal.giLimit;
      setSuccessMsg(
        eoiTriggered
          ? "Enrollment created. Coverage exceeds GI limit — EOI workflow triggered!"
          : "Member enrolled successfully!",
      );
      await load();
      setEnrollModal(null);
      setCoverageAmount("");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  const memberEnrollments = selectedMember
    ? enrollments.filter((e) => String(e.memberId) === selectedMember)
    : enrollments;

  const memberName = (id: bigint) => {
    const m = members.find((m) => m.id === id);
    return m ? `${m.firstName} ${m.lastName}` : "Unknown";
  };

  const planName = (id: bigint) =>
    plans.find((p) => p.id === id)?.name ?? "Unknown Plan";

  const covAmount = Number(coverageAmount || 0);
  const eoiWillTrigger = enrollModal && covAmount > enrollModal.giLimit;

  return (
    <PageWrapper>
      <PageHeader
        title="Enrollment"
        subtitle="Enroll members into insurance plans"
      />

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}

      {/* Member selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Select Member to Enroll
        </h3>
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">All Members</option>
          {members.map((m) => (
            <option key={String(m.id)} value={String(m.id)}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* Available Plans */}
      {canEdit && selectedMember && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Available Plans
          </h3>
          {loading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={String(plan.id)}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                >
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    {plan.name}
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    v{String(plan.version)} • {plan.effectiveDateText}
                  </p>
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">GI Limit</span>
                      <span className="font-semibold text-gray-800">
                        {formatCurrency(plan.giLimit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Coverage Type</span>
                      <span className="font-medium text-gray-700 capitalize">
                        {plan.coverageType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Coverage Value</span>
                      <span className="font-medium text-gray-700">
                        {plan.coverageType === "flat"
                          ? formatCurrency(plan.coverageValue)
                          : `${plan.coverageValue}x salary`}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollModal(plan);
                      setCoverageAmount("");
                    }}
                    className="w-full py-2 text-xs font-medium text-white rounded-lg"
                    style={{ background: "#2F80ED" }}
                  >
                    Enroll in Plan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrollments Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">
            Enrollment Records
          </h3>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "Member",
                  "Plan",
                  "Coverage Amount",
                  "Enrollment Date",
                  "Status",
                  "EOI Triggered",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-gray-500 px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberEnrollments.map((e) => (
                <tr
                  key={String(e.id)}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {memberName(e.memberId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {planName(e.planId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                    {formatCurrency(e.coverageAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {e.enrollmentDateText}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3">
                    {e.eoiTriggered ? (
                      <span className="flex items-center gap-1 text-xs text-yellow-600">
                        <AlertTriangle className="w-3.5 h-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No</span>
                    )}
                  </td>
                </tr>
              ))}
              {memberEnrollments.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No enrollments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Enroll Modal */}
      {enrollModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                Enroll in {enrollModal.name}
              </h2>
              <button
                type="button"
                onClick={() => setEnrollModal(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">GI Limit</span>
                  <span className="font-semibold">
                    {formatCurrency(enrollModal.giLimit)}
                  </span>
                </div>
              </div>
              <div>
                <label
                  htmlFor="enrollment-coverage-amount"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Coverage Amount ($)
                </label>
                <input
                  id="enrollment-coverage-amount"
                  type="number"
                  value={coverageAmount}
                  onChange={(e) => setCoverageAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="e.g. 150000"
                />
              </div>
              {eoiWillTrigger && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700">
                    Coverage exceeds GI limit (
                    {formatCurrency(enrollModal.giLimit)}). EOI workflow will be
                    triggered.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEnrollModal(null)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={saving || !coverageAmount}
                  className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                  style={{ background: "#2F80ED" }}
                >
                  {saving ? "Enrolling..." : "Confirm Enrollment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
