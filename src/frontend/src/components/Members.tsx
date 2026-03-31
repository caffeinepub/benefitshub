import { Download, Pencil, Plus, Upload, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { AuthUser } from "../App";
import {
  type Employer,
  EmploymentType,
  type Member,
  MemberStatus,
} from "../backend.d";
import { backend } from "../lib/backend";
import {
  PageHeader,
  PageWrapper,
  Spinner,
  StatusBadge,
  formatCurrency,
} from "./shared";

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

const EMPTY_MEMBER = (defaultEmployerId = 0n): Omit<Member, "id"> => ({
  employerId: defaultEmployerId,
  firstName: "",
  lastName: "",
  email: "",
  employmentType: EmploymentType.full_time,
  hireDateText: new Date().toISOString().split("T")[0],
  salary: 60000,
  status: MemberStatus.active,
});

const TEMPLATE_HEADERS = [
  "firstName",
  "lastName",
  "email",
  "employerName",
  "employmentType",
  "hireDateText",
  "salary",
  "status",
];

const TEMPLATE_SAMPLE = [
  {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@example.com",
    employerName: "Acme Corporation",
    employmentType: "full_time",
    hireDateText: "2024-01-15",
    salary: 75000,
    status: "active",
  },
];

interface Props {
  user: AuthUser;
  employers: Employer[];
  setEmployers: React.Dispatch<React.SetStateAction<Employer[]>>;
}

export function Members({
  user,
  employers,
  setEmployers: _setEmployers,
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, "id">>(EMPTY_MEMBER());
  const [filterEmployer, setFilterEmployer] = useState<string>("all");
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
      const m = await backend.getAllMembers();
      setMembers(m);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_MEMBER(employers[0]?.id ?? 0n));
    setShowModal(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      employerId: m.employerId,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      employmentType: m.employmentType,
      hireDateText: m.hireDateText,
      salary: m.salary,
      status: m.status,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editing) {
      const updated: Member = { ...form, id: editing.id };
      setMembers((prev) =>
        prev.map((m) => (m.id === editing.id ? updated : m)),
      );
      setShowModal(false);
      try {
        await backend.updateMember(editing.id, updated);
      } catch (err) {
        console.error(err);
        setMembers((prev) =>
          prev.map((m) => (m.id === editing.id ? editing : m)),
        );
      }
    } else {
      const tempId = 0n - BigInt(Date.now());
      const tempMember: Member = { ...form, id: tempId };
      setMembers((prev) => [...prev, tempMember]);
      setShowModal(false);
      try {
        const newId = await backend.createMember({ ...form, id: 0n });
        setMembers((prev) =>
          prev.map((m) => (m.id === tempId ? { ...form, id: newId } : m)),
        );
      } catch (err) {
        console.error(err);
        setMembers((prev) => prev.filter((m) => m.id !== tempId));
      }
    }
    setSaving(false);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_SAMPLE, {
      header: TEMPLATE_HEADERS,
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, "members_upload_template.xlsx");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus({ type: "info", message: "Parsing file..." });
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows =
        XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);

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
      const newMembers: Member[] = [];

      for (const row of rows) {
        const memberData: Omit<Member, "id"> = {
          employerId: (() => {
            const name = String(row.employerName ?? row.employerId ?? "")
              .toLowerCase()
              .trim();
            const match = employers.find(
              (emp) => emp.name.toLowerCase().trim() === name,
            );
            return match ? match.id : (employers[0]?.id ?? 1n);
          })(),
          firstName: String(row.firstName ?? ""),
          lastName: String(row.lastName ?? ""),
          email: String(row.email ?? ""),
          employmentType:
            (row.employmentType as EmploymentType) ?? EmploymentType.full_time,
          hireDateText: String(
            row.hireDateText ?? new Date().toISOString().split("T")[0],
          ),
          salary: Number(row.salary ?? 0),
          status: (row.status as MemberStatus) ?? MemberStatus.active,
        };
        try {
          const newId = await backend.createMember({ ...memberData, id: 0n });
          newMembers.push({ ...memberData, id: newId });
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
        setMembers((prev) => [...prev, ...newMembers]);
        const failed = rows.length - successCount;
        const msg =
          failed > 0
            ? `${successCount} of ${rows.length} member(s) imported. ${failed} row(s) skipped due to errors.`
            : `${successCount} member(s) imported successfully.`;
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

  const filtered =
    filterEmployer === "all"
      ? members
      : members.filter((m) => String(m.employerId) === filterEmployer);
  const employerName = (id: bigint) =>
    employers.find((e) => e.id === id)?.name ?? "Unknown";

  const uploadStatusColors = {
    info: "bg-blue-50 border-blue-200 text-blue-700",
    success: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Member Management"
        subtitle="Manage all insured members"
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                data-ocid="members.download_template.button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> Download Template
              </button>
              <label
                data-ocid="members.upload_button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
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
                data-ocid="members.add.primary_button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
                style={{ background: "#2F80ED" }}
              >
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>
          ) : undefined
        }
      />

      {uploadStatus && (
        <div
          data-ocid={`members.upload.${uploadStatus.type}_state`}
          className={`mb-3 px-4 py-2 rounded-lg text-sm border ${
            uploadStatusColors[uploadStatus.type]
          }`}
        >
          {uploadStatus.message}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <select
          value={filterEmployer}
          onChange={(e) => setFilterEmployer(e.target.value)}
          data-ocid="members.employer_filter.select"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">All Employers</option>
          {employers.map((e) => (
            <option key={String(e.id)} value={String(e.id)}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <Spinner />
        ) : (
          <table className="w-full" data-ocid="members.table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "Name",
                  "Employer",
                  "Email",
                  "Employment Type",
                  "Hire Date",
                  "Salary",
                  "Status",
                  canEdit ? "Actions" : "",
                ]
                  .filter(Boolean)
                  .map((h) => (
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
              {filtered.map((m, idx) => (
                <tr
                  key={String(m.id)}
                  data-ocid={`members.item.${idx + 1}`}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {m.firstName[0]}
                        {m.lastName[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-800">
                        {m.firstName} {m.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {employerName(m.employerId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                    {m.employmentType.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {m.hireDateText}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatCurrency(m.salary)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        data-ocid={`members.edit_button.${idx + 1}`}
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
                    colSpan={8}
                    data-ocid="members.empty_state"
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? "Edit Member" : "Add Member"}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-3" data-ocid="members.modal">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name">
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                />
              </Field>
              <Field label="Last Name">
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Email">
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Employer">
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={String(form.employerId)}
                data-ocid="members.employer.select"
                onChange={(e) =>
                  setForm({ ...form, employerId: BigInt(e.target.value) })
                }
              >
                {employers.map((e) => (
                  <option key={String(e.id)} value={String(e.id)}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employment Type">
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.employmentType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      employmentType: e.target.value as EmploymentType,
                    })
                  }
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                </select>
              </Field>
              <Field label="Hire Date">
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  type="date"
                  value={form.hireDateText}
                  onChange={(e) =>
                    setForm({ ...form, hireDateText: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Annual Salary ($)">
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                type="number"
                value={form.salary}
                onChange={(e) =>
                  setForm({ ...form, salary: Number(e.target.value) })
                }
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                data-ocid="members.modal.cancel_button"
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                data-ocid="members.modal.submit_button"
                className="px-4 py-2 text-sm text-white rounded-lg"
                style={{ background: "#2F80ED" }}
              >
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PageWrapper>
  );
}

function Modal({
  title,
  onClose,
  children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            data-ocid="members.modal.close_button"
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: { label: string; children: React.ReactNode }) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-xs font-medium text-gray-600 mb-1"
      >
        {label}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
            id: fieldId,
          })
        : children}
    </div>
  );
}
