import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Pencil,
  Plus,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { AuthUser } from "../App";
import { type Assignment, AssignmentRole } from "../backend.d";
import { backend } from "../lib/backend";
import { PageHeader, PageWrapper, Spinner, StatusBadge } from "./shared";

const SERVICE_UNAVAILABLE_MSG =
  "Upload failed — the system service required for this operation is currently unavailable. Please try again in a few minutes. If the issue persists, contact support.";

function isServiceUnavailableError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return [
    "canister",
    "503",
    "unavailable",
    "not running",
    "ic0503",
    "ic0504",
    "rejected",
    "agenterror",
    "fetch",
  ].some((pattern) => msg.includes(pattern));
}

function logTechnicalError(context: string, err: unknown) {
  const requestId = `REQ-${Date.now()}`;
  const errStr = String(err);
  const codeMatch = errStr.match(/IC\d+|\b5\d{2}\b/);
  const errorCode = codeMatch ? codeMatch[0] : "UNKNOWN";
  console.error({
    requestId,
    context,
    timestamp: new Date().toISOString(),
    errorCode,
    serviceStatus: "UNAVAILABLE",
    rawError: errStr,
  });
  console.warn(
    `[ADMIN ALERT] Backend service unavailable. Action required: check and restart the backend service. RequestId: ${requestId}`,
  );
}

type AssignmentStatus = "active" | "inactive";

const ROLES = ["all", "admin", "underwriter", "billing", "viewer"] as const;
type RoleFilter = (typeof ROLES)[number];
type SortField = "name" | "email" | "role" | "status";
type SortDir = "asc" | "desc";

const TEMPLATE_HEADERS = ["name", "email", "role", "status"];
const TEMPLATE_SAMPLE = [
  {
    name: "Alice Smith",
    email: "alice@example.com",
    role: "underwriter",
    status: "active",
  },
];

export function AssignmentMaster({ user }: { user: AuthUser }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "underwriter" as AssignmentRole,
    status: "active" as AssignmentStatus,
  });
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = user.role === "admin";

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const a = await backend.getAllAssignments();
      setAssignments(a);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      role: AssignmentRole.underwriter,
      status: "active" as AssignmentStatus,
    });
    setShowModal(true);
  }

  function openEdit(a: Assignment) {
    setEditing(a);
    setForm({ name: a.name, email: a.email, role: a.role, status: a.status });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editing) {
      // Optimistic update + close modal immediately
      const updated: Assignment = { ...editing, ...form };
      setAssignments((prev) =>
        prev.map((a) => (a.id === editing.id ? updated : a)),
      );
      setShowModal(false);
      try {
        await backend.updateAssignment(editing.id, updated);
      } catch (err) {
        console.error(err);
        // Revert on failure
        setAssignments((prev) =>
          prev.map((a) => (a.id === editing.id ? editing : a)),
        );
      }
    } else {
      // Optimistic add + close modal immediately
      const tempId = BigInt(Date.now());
      const tempRecord: Assignment = {
        id: tempId,
        name: form.name,
        email: form.email,
        role: form.role,
        status: form.status as AssignmentStatus,
      };
      setAssignments((prev) => [...prev, tempRecord]);
      setShowModal(false);
      try {
        await backend.createAssignment(form.name, form.email, form.role);
        // Refresh to get the real ID from backend
        load();
      } catch (err) {
        console.error(err);
        // Revert on failure
        setAssignments((prev) => prev.filter((a) => a.id !== tempId));
      }
    }
    setSaving(false);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_SAMPLE, {
      header: TEMPLATE_HEADERS,
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assignments");
    XLSX.writeFile(wb, "assignment_upload_template.xlsx");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus({ type: "info", message: "Parsing file..." });
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      if (rows.length === 0) {
        setUploadStatus({
          type: "error",
          message: "The file contains no data rows.",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setUploadStatus(null), 5000);
        return;
      }

      let successCount = 0;
      let lastError = "";
      let lastRawError: unknown = null;
      const newAssignments: Assignment[] = [];

      for (const row of rows) {
        try {
          await backend.createAssignment(
            String(row.name ?? ""),
            String(row.email ?? ""),
            (row.role as AssignmentRole) ?? AssignmentRole.underwriter,
          );
          newAssignments.push({
            id: BigInt(Date.now() + successCount),
            name: String(row.name ?? ""),
            email: String(row.email ?? ""),
            role: (row.role as AssignmentRole) ?? AssignmentRole.underwriter,
            status: (row.status as AssignmentStatus) ?? "active",
          });
          successCount++;
        } catch (rowErr) {
          lastRawError = rowErr;
          lastError = rowErr instanceof Error ? rowErr.message : String(rowErr);
          if (isServiceUnavailableError(rowErr)) {
            logTechnicalError("row-upload", rowErr);
          }
        }
      }

      if (successCount === 0) {
        if (lastRawError !== null && isServiceUnavailableError(lastRawError)) {
          setUploadStatus({ type: "error", message: SERVICE_UNAVAILABLE_MSG });
        } else {
          const reason = lastError
            ? `: ${lastError}`
            : ". Check the file format and try again.";
          setUploadStatus({
            type: "error",
            message: `Upload failed — no records were imported${reason}`,
          });
        }
      } else {
        setAssignments((prev) => [...prev, ...newAssignments]);
        const failed = rows.length - successCount;
        const msg =
          failed > 0
            ? `${successCount} of ${rows.length} record(s) imported. ${failed} row(s) skipped due to errors.`
            : `${successCount} record(s) imported successfully.`;
        setUploadStatus({ type: "success", message: msg });
        load();
      }
    } catch (err) {
      if (isServiceUnavailableError(err)) {
        logTechnicalError("file-upload", err);
        setUploadStatus({ type: "error", message: SERVICE_UNAVAILABLE_MSG });
      } else {
        const reason = err instanceof Error ? err.message : "Unknown error";
        setUploadStatus({
          type: "error",
          message: `Upload failed — ${reason}. Ensure the file is a valid .xlsx or .csv.`,
        });
        console.error(err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setUploadStatus(null), 6000);
  }

  const filtered = useMemo(() => {
    const base =
      roleFilter === "all"
        ? assignments
        : assignments.filter((a) => a.role === roleFilter);
    return [...base].sort((a, b) => {
      let av = "";
      let bv = "";
      if (sortField === "name") {
        av = a.name;
        bv = b.name;
      } else if (sortField === "email") {
        av = a.email;
        bv = b.email;
      } else if (sortField === "role") {
        av = String(a.role);
        bv = String(b.role);
      } else if (sortField === "status") {
        av = String(a.status);
        bv = String(b.status);
      }
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [assignments, roleFilter, sortField, sortDir]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1 text-blue-500" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />
    );
  }

  const sortableHeaders: { label: string; field: SortField }[] = [
    { label: "Name", field: "name" },
    { label: "Email", field: "email" },
    { label: "Role", field: "role" },
    { label: "Status", field: "status" },
  ];

  const uploadStatusColors = {
    info: "bg-blue-50 border-blue-200 text-blue-700",
    success: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Assignment Master"
        subtitle="Manage user pool for EOI assignment"
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> Download Template
              </button>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" /> Upload Excel
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <button
                type="button"
                onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
                style={{ background: "#2F80ED" }}
              >
                <Plus className="w-4 h-4" /> Add User
              </button>
            </div>
          ) : undefined
        }
      />

      {uploadStatus && (
        <div
          className={`mb-3 px-4 py-2 rounded-lg text-sm border ${
            uploadStatusColors[uploadStatus.type]
          }`}
        >
          {uploadStatus.message}
        </div>
      )}

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {ROLES.map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
              roleFilter === r
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {r}
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
                {sortableHeaders.map(({ label, field }) => (
                  <th
                    key={field}
                    className="text-left text-xs font-semibold text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-gray-700"
                    onClick={() => toggleSort(field)}
                    onKeyDown={(e) => e.key === "Enter" && toggleSort(field)}
                  >
                    <span className="flex items-center">
                      {label}
                      <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                {canEdit && (
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={String(a.id)}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {a.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800">
                        {a.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{a.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No users found
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
                {editing ? "Edit User" : "Add User"}
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
                  htmlFor="am-name"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="am-name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label
                  htmlFor="am-email"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Email
                </label>
                <input
                  id="am-email"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label
                  htmlFor="am-role"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Role
                </label>
                <select
                  id="am-role"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as AssignmentRole })
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="underwriter">Underwriter</option>
                  <option value="billing">Billing</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              {editing && (
                <div>
                  <label
                    htmlFor="am-status"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="am-status"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as AssignmentStatus,
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
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
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white rounded-lg"
                  style={{ background: "#2F80ED" }}
                >
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
