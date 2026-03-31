import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useState } from "react";
import type { DynamicEligibilityRule } from "../backend.d";
import { backend } from "../lib/backend";
import type { RuleCondition, RuleOperator } from "../lib/eligibilityEngine";
import { SAMPLE_REQUEST, SAMPLE_RESPONSE } from "../lib/eligibilityEngine";

interface EligibilityRuleBuilderProps {
  planId: bigint;
  planName: string;
  editingRule?: DynamicEligibilityRule | null;
  onSave: (rule: DynamicEligibilityRule) => void;
  onClose: () => void;
  canEdit: boolean;
}

const FIELD_OPTIONS = [
  { value: "employmentType", label: "Employment Type" },
  { value: "salary", label: "Salary" },
  { value: "status", label: "Status" },
  { value: "hireDateText", label: "Hire Date" },
];

const OPERATOR_OPTIONS: { value: RuleOperator; label: string }[] = [
  { value: "equals", label: "equals (=)" },
  { value: "gte", label: "greater than or equal (≥)" },
  { value: "lte", label: "less than or equal (≤)" },
  { value: "in", label: "in (comma-separated)" },
];

function emptyCondition(): RuleCondition {
  return { field: "employmentType", operator: "equals", value: "" };
}

export function EligibilityRuleBuilder({
  planId,
  planName,
  editingRule,
  onSave,
  onClose,
}: EligibilityRuleBuilderProps) {
  const isEditing = !!editingRule;

  const parseConditions = (): RuleCondition[] => {
    if (!editingRule?.conditionsJson) return [emptyCondition()];
    try {
      const parsed = JSON.parse(editingRule.conditionsJson);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : [emptyCondition()];
    } catch {
      return [emptyCondition()];
    }
  };

  const [name, setName] = useState(editingRule?.name ?? "");
  const [active, setActive] = useState(editingRule?.active ?? true);
  const [conditions, setConditions] =
    useState<RuleCondition[]>(parseConditions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSample, setShowSample] = useState(false);

  function addCondition() {
    setConditions((prev) => [...prev, emptyCondition()]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, patch: Partial<RuleCondition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Rule name is required.");
      return;
    }
    for (const c of conditions) {
      if (!c.field || !c.value.trim()) {
        setError("All conditions must have a field and value.");
        return;
      }
    }
    setError("");
    setSaving(true);

    const conditionsJson = JSON.stringify(conditions);
    const rulePayload: DynamicEligibilityRule = {
      id: editingRule?.id ?? 0n,
      planId,
      name: name.trim(),
      active,
      conditionsJson,
    };

    try {
      if (isEditing && editingRule) {
        await backend.updateDynamicRule(editingRule.id, rulePayload);
        onSave({ ...rulePayload, id: editingRule.id });
      } else {
        const newId = await backend.createDynamicRule(rulePayload);
        onSave({ ...rulePayload, id: newId });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to save rule. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      data-ocid="rule_builder.modal"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800">
              {isEditing ? "Edit Eligibility Rule" : "Add Eligibility Rule"}
            </h2>
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded px-2 py-0.5 font-medium">
              {planName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            data-ocid="rule_builder.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Rule Name */}
          <div>
            <label
              htmlFor="rule-name"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Rule Name <span className="text-red-400">*</span>
            </label>
            <input
              id="rule-name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="e.g. Full-Time Eligibility Rule"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-ocid="rule_builder.input"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <input
              id="rule-active"
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              data-ocid="rule_builder.checkbox"
            />
            <label
              htmlFor="rule-active"
              className="text-sm text-gray-700 cursor-pointer"
            >
              Active
            </label>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600">
                Conditions{" "}
                <span className="text-gray-400 font-normal">
                  (ALL must be true)
                </span>
              </p>
              <button
                type="button"
                onClick={addCondition}
                className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 rounded-md px-2 py-1 hover:bg-blue-50"
                data-ocid="rule_builder.secondary_button"
              >
                <Plus className="w-3 h-3" /> Add Condition
              </button>
            </div>

            <div className="space-y-2">
              {conditions.map((cond, idx) => {
                const condKey = `cond-${idx}`;
                return (
                  <div
                    key={condKey}
                    className="flex gap-2 items-start bg-gray-50 rounded-lg p-2"
                    data-ocid={`rule_builder.item.${idx + 1}`}
                  >
                    <select
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
                      value={cond.field}
                      onChange={(e) =>
                        updateCondition(idx, { field: e.target.value })
                      }
                      data-ocid="rule_builder.select"
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
                      value={cond.operator}
                      onChange={(e) =>
                        updateCondition(idx, {
                          operator: e.target.value as RuleOperator,
                        })
                      }
                      data-ocid="rule_builder.select"
                    >
                      {OPERATOR_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs"
                      placeholder={
                        cond.operator === "in" ? "val1, val2" : "value"
                      }
                      value={cond.value}
                      onChange={(e) =>
                        updateCondition(idx, { value: e.target.value })
                      }
                      data-ocid="rule_builder.input"
                    />
                    {conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        data-ocid={`rule_builder.delete_button.${idx + 1}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p
              className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded"
              data-ocid="rule_builder.error_state"
            >
              {error}
            </p>
          )}

          {/* Sample API panel */}
          <div className="border border-gray-100 rounded-lg">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg"
              onClick={() => setShowSample((s) => !s)}
            >
              <span>View Sample Request / Response</span>
              {showSample ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {showSample && (
              <div className="px-3 pb-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Sample Request
                  </p>
                  <pre className="text-xs bg-gray-900 text-green-300 rounded p-3 overflow-x-auto">
                    {JSON.stringify(SAMPLE_REQUEST, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Sample Response
                  </p>
                  <pre className="text-xs bg-gray-900 text-green-300 rounded p-3 overflow-x-auto">
                    {JSON.stringify(SAMPLE_RESPONSE, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            data-ocid="rule_builder.cancel_button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
            style={{ background: "#2F80ED" }}
            data-ocid="rule_builder.submit_button"
          >
            {saving ? "Saving..." : isEditing ? "Update Rule" : "Save Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
