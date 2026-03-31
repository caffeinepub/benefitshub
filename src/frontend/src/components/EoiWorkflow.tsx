import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "../App";
import {
  type Assignment,
  type EoiRequest,
  EoiStatus,
  type InsurancePlan,
  type Member,
} from "../backend.d";
import { backend } from "../lib/backend";
import {
  PageHeader,
  PageWrapper,
  Spinner,
  StatusBadge,
  formatCurrency,
} from "./shared";

const STATUS_TABS = [
  "all",
  "pending",
  "in_review",
  "approved",
  "declined",
] as const;
type Tab = (typeof STATUS_TABS)[number];

export function EoiWorkflow({ user }: { user: AuthUser }) {
  const [eoiList, setEoiList] = useState<EoiRequest[]>([]);
  const [underwriters, setUnderwriters] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [assignModal, setAssignModal] = useState<EoiRequest | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = user.role === "admin";
  const canUpdateStatus = isAdmin || user.role === "underwriter";

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [eoi, assigns, m, p] = await Promise.all([
        backend.getAllEoiRequests(),
        backend.getActiveAssignments(),
        backend.getAllMembers(),
        backend.getAllPlans(),
      ]);
      setEoiList(eoi);
      setUnderwriters(assigns.filter((a) => a.role === "underwriter"));
      setMembers(m);
      setPlans(p);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleAssign() {
    if (!assignModal || !selectedAssignee) return;
    setSaving(true);
    try {
      await backend.assignEoiRequest(
        assignModal.id,
        selectedAssignee,
        user.name,
        new Date().toISOString(),
      );
      await load();
      setAssignModal(null);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  async function handleStatusUpdate(id: bigint, status: EoiStatus) {
    try {
      await backend.updateEoiStatus(
        id,
        status,
        user.name,
        new Date().toISOString(),
        `Status updated to ${status}`,
      );
      await load();
    } catch (err) {
      console.error(err);
    }
  }

  const memberName = (id: bigint) => {
    const m = members.find((m) => m.id === id);
    return m ? `${m.firstName} ${m.lastName}` : String(id);
  };
  const planName = (id: bigint) =>
    plans.find((p) => p.id === id)?.name ?? String(id);

  const filtered =
    tab === "all" ? eoiList : eoiList.filter((e) => e.status === tab);

  return (
    <PageWrapper>
      <PageHeader
        title="EOI Workflow"
        subtitle="Evidence of Insurability case management"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.replace("_", " ")}{" "}
            {t !== "all" && `(${eoiList.filter((e) => e.status === t).length})`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <Spinner />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "#",
                  "Member",
                  "Plan",
                  "Coverage",
                  "GI Limit",
                  "Assigned To",
                  "Status",
                  "SLA Deadline",
                  "Actions",
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
              {filtered.map((eoi) => (
                <>
                  <tr
                    key={String(eoi.id)}
                    className="border-t border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 text-xs text-gray-400">
                      #{String(eoi.id)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {memberName(eoi.memberId)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {planName(eoi.planId)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {formatCurrency(eoi.coverageRequested)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatCurrency(eoi.giLimit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {eoi.assignedTo ?? (
                        <span className="text-gray-300">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={eoi.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {eoi.slaDeadlineText.split("T")[0]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {isAdmin && eoi.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignModal(eoi);
                              setSelectedAssignee("");
                            }}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                          >
                            Assign
                          </button>
                        )}
                        {canUpdateStatus &&
                          (eoi.status === "pending" ||
                            eoi.status === "in_review") && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusUpdate(eoi.id, EoiStatus.approved)
                                }
                                className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusUpdate(eoi.id, EoiStatus.declined)
                                }
                                className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                              >
                                Decline
                              </button>
                            </>
                          )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAudit(
                              expandedAudit === String(eoi.id)
                                ? null
                                : String(eoi.id),
                            )
                          }
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          {expandedAudit === String(eoi.id) ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedAudit === String(eoi.id) && (
                    <tr
                      key={`audit-${String(eoi.id)}`}
                      className="bg-gray-50 border-t border-gray-100"
                    >
                      <td colSpan={9} className="px-6 py-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          Audit Log
                        </p>
                        {eoi.auditLog.length === 0 ? (
                          <p className="text-xs text-gray-400">
                            No audit entries yet
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {eoi.auditLog.map((entry, i) => (
                              <div
                                key={`${entry.atText}-${i}`}
                                className="flex gap-3 text-xs"
                              >
                                <span className="text-gray-400">
                                  {entry.atText.split("T")[0]}
                                </span>
                                <span className="font-medium text-gray-700">
                                  {entry.action}
                                </span>
                                <span className="text-gray-500">
                                  by {entry.by}
                                </span>
                                {entry.note && (
                                  <span className="text-gray-400">
                                    — {entry.note}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No EOI cases found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                Assign EOI Case #{String(assignModal.id)}
              </h2>
              <button
                type="button"
                onClick={() => setAssignModal(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="eoi-assignee"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Assign to Underwriter
                </label>
                <select
                  id="eoi-assignee"
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select underwriter...</option>
                  {underwriters.map((u) => (
                    <option key={String(u.id)} value={u.name}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={saving || !selectedAssignee}
                  className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                  style={{ background: "#2F80ED" }}
                >
                  {saving ? "Assigning..." : "Assign Case"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
