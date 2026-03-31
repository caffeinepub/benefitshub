import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "../App";
import {
  type BillingRecord,
  BillingStatus,
  type BillingType,
  type Enrollment,
  type InsurancePlan,
  type Member,
} from "../backend.d";
import { backend } from "../lib/backend";
import {
  KpiCard,
  PageHeader,
  PageWrapper,
  Spinner,
  StatusBadge,
  formatCurrency,
} from "./shared";

export function BillingView({ user }: { user: AuthUser }) {
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [_plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enrollmentId: "",
    memberId: "",
    billingType: "list" as BillingType,
    billingPeriodText: new Date().toISOString().slice(0, 7),
    rate: 0.005,
    coverageAmount: 0,
  });

  const canEdit = user.role === "admin" || user.role === "billing";

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [b, e, m, p] = await Promise.all([
        backend.getAllBillingRecords(),
        backend.getAllEnrollments(),
        backend.getAllMembers(),
        backend.getAllPlans(),
      ]);
      setBilling(b);
      setEnrollments(e.filter((en) => en.status === "active"));
      setMembers(m);
      setPlans(p);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    if (!form.enrollmentId || !form.memberId) return;
    setSaving(true);
    try {
      const premium = form.coverageAmount * form.rate;
      const invoiceNumber = `INV-${Date.now()}`;
      await backend.createBillingRecord(
        BigInt(form.enrollmentId),
        BigInt(form.memberId),
        form.billingType,
        form.billingPeriodText,
        premium,
        form.rate,
        form.coverageAmount,
        invoiceNumber,
        new Date().toISOString().split("T")[0],
      );
      await load();
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  const memberName = (id: bigint) => {
    const m = members.find((m) => m.id === id);
    return m ? `${m.firstName} ${m.lastName}` : String(id);
  };

  const totalPremium = billing.reduce((s, b) => s + b.premium, 0);
  const paidTotal = billing
    .filter((b) => b.status === "paid")
    .reduce((s, b) => s + b.premium, 0);
  const listCount = billing.filter((b) => b.billingType === "list").length;
  const _selfCount = billing.filter((b) => b.billingType === "self").length;
  const retroCount = billing.filter((b) => b.billingType === "retro").length;

  return (
    <PageWrapper>
      <PageHeader
        title="Billing View"
        subtitle="Premium billing records and invoice management"
        action={
          canEdit ? (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
              style={{ background: "#2F80ED" }}
            >
              <Plus className="w-4 h-4" /> Generate Invoice
            </button>
          ) : undefined
        }
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Premium"
          value={formatCurrency(totalPremium)}
          sub="All records"
          color="#8B5CF6"
        />
        <KpiCard
          label="Collected"
          value={formatCurrency(paidTotal)}
          sub="Paid invoices"
          color="#19A974"
        />
        <KpiCard
          label="List Billing"
          value={listCount}
          sub="Records"
          color="#2F80ED"
        />
        <KpiCard
          label="Retro Adjustments"
          value={retroCount}
          sub="Records"
          color="#F59E0B"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <Spinner />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "Invoice #",
                  "Member",
                  "Coverage",
                  "Rate",
                  "Premium",
                  "Type",
                  "Period",
                  "Status",
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
              {billing.map((b) => (
                <tr
                  key={String(b.id)}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">
                    {b.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {memberName(b.memberId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatCurrency(b.coverageAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {(b.rate * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                    {formatCurrency(b.premium)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.billingType} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {b.billingPeriodText}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
              {billing.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No billing records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                Generate Invoice
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label
                  htmlFor="billing-enrollment"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Enrollment
                </label>
                <select
                  id="billing-enrollment"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.enrollmentId}
                  onChange={(e) => {
                    const enroll = enrollments.find(
                      (en) => String(en.id) === e.target.value,
                    );
                    setForm({
                      ...form,
                      enrollmentId: e.target.value,
                      memberId: enroll ? String(enroll.memberId) : "",
                      coverageAmount: enroll?.coverageAmount ?? 0,
                    });
                  }}
                >
                  <option value="">Select enrollment...</option>
                  {enrollments.map((en) => (
                    <option key={String(en.id)} value={String(en.id)}>
                      {memberName(en.memberId)} —{" "}
                      {formatCurrency(en.coverageAmount)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="billing-coverage-amount"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Coverage Amount
                  </label>
                  <input
                    id="billing-coverage-amount"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    type="number"
                    value={form.coverageAmount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        coverageAmount: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="billing-rate"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Rate (e.g. 0.005)
                  </label>
                  <input
                    id="billing-rate"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    type="number"
                    step="0.001"
                    value={form.rate}
                    onChange={(e) =>
                      setForm({ ...form, rate: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs">
                <span className="text-blue-600 font-semibold">
                  Calculated Premium:{" "}
                  {formatCurrency(form.coverageAmount * form.rate)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="billing-type"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Billing Type
                  </label>
                  <select
                    id="billing-type"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    value={form.billingType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        billingType: e.target.value as BillingType,
                      })
                    }
                  >
                    <option value="list">List Billing</option>
                    <option value="self">Self Billing</option>
                    <option value="retro">Retro Adjustment</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="billing-period"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Billing Period
                  </label>
                  <input
                    id="billing-period"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    type="month"
                    value={form.billingPeriodText}
                    onChange={(e) =>
                      setForm({ ...form, billingPeriodText: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={saving || !form.enrollmentId}
                  className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                  style={{ background: "#2F80ED" }}
                >
                  {saving ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
