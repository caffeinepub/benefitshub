import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import React, { useState } from "react";
import type { AuthUser } from "../App";
import { type Employer, EmployerStatus } from "../backend.d";
import { backend } from "../lib/backend";
import { PageHeader, PageWrapper, StatusBadge } from "./shared";

const EMPTY_EMPLOYER = (): Omit<Employer, "id"> => ({
  name: "",
  industry: "",
  contactEmail: "",
  status: EmployerStatus.active,
});

interface Props {
  user: AuthUser;
  employers: Employer[];
  setEmployers: React.Dispatch<React.SetStateAction<Employer[]>>;
}

export function EmployerMaster({ user, employers, setEmployers }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employer | null>(null);
  const [form, setForm] = useState<Omit<Employer, "id">>(EMPTY_EMPLOYER());
  const [saving, setSaving] = useState(false);

  const canEdit = user.role === "admin";

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_EMPLOYER());
    setShowModal(true);
  }

  function openEdit(emp: Employer) {
    setEditing(emp);
    setForm({
      name: emp.name,
      industry: emp.industry,
      contactEmail: emp.contactEmail,
      status: emp.status,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editing) {
      const updated: Employer = { ...form, id: editing.id };
      setEmployers((prev) =>
        prev.map((e) => (e.id === editing.id ? updated : e)),
      );
      setShowModal(false);
      try {
        await backend.updateEmployer(editing.id, updated);
      } catch (err) {
        console.error(err);
        setEmployers((prev) =>
          prev.map((e) => (e.id === editing.id ? editing : e)),
        );
      }
    } else {
      const tempId = 0n - BigInt(Date.now());
      const tempEmployer: Employer = { ...form, id: tempId };
      setEmployers((prev) => [...prev, tempEmployer]);
      setShowModal(false);
      try {
        const newId = await backend.createEmployer(
          form.name,
          form.industry,
          form.contactEmail,
        );
        setEmployers((prev) =>
          prev.map((e) => (e.id === tempId ? { ...form, id: newId } : e)),
        );
      } catch (err) {
        console.error(err);
        setEmployers((prev) => prev.filter((e) => e.id !== tempId));
      }
    }
    setSaving(false);
  }

  async function handleDelete(emp: Employer) {
    if (
      !window.confirm(`Delete employer "${emp.name}"? This cannot be undone.`)
    )
      return;
    setEmployers((prev) => prev.filter((e) => e.id !== emp.id));
    try {
      await backend.deleteEmployer(emp.id);
    } catch (err) {
      console.error(err);
      setEmployers((prev) => [...prev, emp]);
    }
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Employer Master"
        subtitle="Manage employer organizations"
        action={
          canEdit ? (
            <button
              type="button"
              onClick={openAdd}
              data-ocid="employers.add.primary_button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
              style={{ background: "#2F80ED" }}
            >
              <Plus className="w-4 h-4" /> Add Employer
            </button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full" data-ocid="employers.table">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {[
                "Name",
                "Industry",
                "Contact Email",
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
            {employers.map((emp, idx) => (
              <tr
                key={String(emp.id)}
                data-ocid={`employers.item.${idx + 1}`}
                className="border-t border-gray-50 hover:bg-gray-50/50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {emp.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {emp.industry}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {emp.contactEmail}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={emp.status} />
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(emp)}
                        data-ocid={`employers.edit_button.${idx + 1}`}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(emp)}
                        data-ocid={`employers.delete_button.${idx + 1}`}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {employers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  data-ocid="employers.empty_state"
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No employers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title={editing ? "Edit Employer" : "Add Employer"}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-3" data-ocid="employers.modal">
            <Field label="Company Name">
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.name}
                placeholder="e.g. Acme Corporation"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Industry">
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.industry}
                placeholder="e.g. Technology"
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </Field>
            <Field label="Contact Email">
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                type="email"
                value={form.contactEmail}
                placeholder="hr@company.com"
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
              />
            </Field>
            <Field label="Status">
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.status}
                data-ocid="employers.status.select"
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as EmployerStatus })
                }
              >
                <option value={EmployerStatus.active}>Active</option>
                <option value={EmployerStatus.inactive}>Inactive</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                data-ocid="employers.modal.cancel_button"
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                data-ocid="employers.modal.submit_button"
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
            data-ocid="employers.modal.close_button"
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
  const fieldId = `emp-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
