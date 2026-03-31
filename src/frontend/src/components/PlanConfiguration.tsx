import { useEffect, useState } from "react";
import {
  CoverageType,
  type DynamicEligibilityRule,
  type EligibilityRule,
  type InsurancePlan,
  type Member,
} from "../backend.d";
import { backend } from "../lib/backend";
type PlanStatus = "active" | "inactive";
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { AuthUser } from "../App";
import type { RuleCondition } from "../lib/eligibilityEngine";
import { evaluateRule } from "../lib/eligibilityEngine";
import { EligibilityRuleBuilder } from "./EligibilityRuleBuilder";
import {
  PageHeader,
  PageWrapper,
  Spinner,
  StatusBadge,
  formatCurrency,
} from "./shared";

export function PlanConfiguration({ user }: { user: AuthUser }) {
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [dynamicRules, setDynamicRules] = useState<DynamicEligibilityRule[]>(
    [],
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InsurancePlan | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    giLimit: 50000,
    coverageType: "flat" as CoverageType,
    coverageValue: 50000,
    effectiveDateText: new Date().toISOString().split("T")[0],
  });

  // Rule builder state
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<DynamicEligibilityRule | null>(
    null,
  );
  const [ruleBuilderPlanId, setRuleBuilderPlanId] = useState<bigint>(0n);
  const [ruleBuilderPlanName, setRuleBuilderPlanName] = useState("");

  // Test eligibility state per plan
  const [testExpanded, setTestExpanded] = useState<Record<string, boolean>>({});
  const [selectedMember, setSelectedMember] = useState<Record<string, string>>(
    {},
  );
  const [evalResult, setEvalResult] = useState<
    Record<string, { eligible: boolean; reason: string } | null>
  >({});

  const canEdit = user.role === "admin";

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [p, r, dr] = await Promise.all([
        backend.getAllPlans(),
        backend.getAllEligibilityRules(),
        backend.getAllDynamicRules(),
      ]);
      setPlans(p);
      setRules(r);
      setDynamicRules(dr);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function loadMembers() {
    if (membersLoaded) return;
    try {
      const m = await backend.getAllMembers();
      setMembers(m);
      setMembersLoaded(true);
    } catch (err) {
      console.error(err);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({
      name: "",
      giLimit: 50000,
      coverageType: CoverageType.flat,
      coverageValue: 50000,
      effectiveDateText: new Date().toISOString().split("T")[0],
    });
    setShowModal(true);
  }

  function openEdit(p: InsurancePlan) {
    setEditing(p);
    setForm({
      name: p.name,
      giLimit: p.giLimit,
      coverageType: p.coverageType,
      coverageValue: p.coverageValue,
      effectiveDateText: p.effectiveDateText,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editing) {
      const updated: InsurancePlan = {
        ...editing,
        ...form,
        version: editing.version + 1n,
      };
      setPlans((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
      setShowModal(false);
      try {
        await backend.updatePlan(editing.id, updated);
      } catch (err) {
        console.error(err);
        setPlans((prev) =>
          prev.map((p) => (p.id === editing.id ? editing : p)),
        );
      }
    } else {
      const tempId = 0n - BigInt(Date.now());
      const tempPlan: InsurancePlan = {
        id: tempId,
        ...form,
        version: 1n,
        status: "active" as PlanStatus,
      };
      setPlans((prev) => [...prev, tempPlan]);
      setShowModal(false);
      try {
        const newId = await backend.createPlan({
          id: 0n,
          ...form,
          version: 1n,
          status: "active" as PlanStatus,
        });
        setPlans((prev) =>
          prev.map((p) => (p.id === tempId ? { ...tempPlan, id: newId } : p)),
        );
      } catch (err) {
        console.error(err);
        setPlans((prev) => prev.filter((p) => p.id !== tempId));
      }
    }
    setSaving(false);
  }

  const planRules = (planId: bigint) =>
    rules.filter((r) => r.planId === planId);
  const planDynamicRules = (planId: bigint) =>
    dynamicRules.filter((r) => r.planId === planId);

  function openRuleBuilder(
    planId: bigint,
    planName: string,
    rule?: DynamicEligibilityRule,
  ) {
    setRuleBuilderPlanId(planId);
    setRuleBuilderPlanName(planName);
    setEditingRule(rule ?? null);
    setShowRuleBuilder(true);
  }

  function handleRuleSaved(rule: DynamicEligibilityRule) {
    setDynamicRules((prev) => {
      const exists = prev.find((r) => r.id === rule.id);
      if (exists) return prev.map((r) => (r.id === rule.id ? rule : r));
      return [...prev, rule];
    });
    setShowRuleBuilder(false);
  }

  async function deleteRule(id: bigint) {
    setDynamicRules((prev) => prev.filter((r) => r.id !== id));
    try {
      await backend.deleteDynamicRule(id);
    } catch (err) {
      console.error(err);
      // Reload on error
      load();
    }
  }

  function toggleTestPanel(planId: string) {
    const next = !testExpanded[planId];
    setTestExpanded((prev) => ({ ...prev, [planId]: next }));
    if (next) loadMembers();
  }

  function runEvaluation(planId: string) {
    const memberId = selectedMember[planId];
    if (!memberId) return;
    const member = members.find((m) => String(m.id) === memberId);
    if (!member) return;
    const pId = BigInt(planId);
    const activeRules = planDynamicRules(pId).filter((r) => r.active);
    if (activeRules.length === 0) {
      setEvalResult((prev) => ({
        ...prev,
        [planId]: {
          eligible: false,
          reason: "No active rules configured for this plan",
        },
      }));
      return;
    }
    // Evaluate against each active rule (member must pass at least one)
    let lastResult = { eligible: false, reason: "No matching rule" };
    for (const dr of activeRules) {
      let conditions: RuleCondition[] = [];
      try {
        conditions = JSON.parse(dr.conditionsJson);
      } catch {
        continue;
      }
      const memberInput = {
        id: Number(member.id),
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        employmentType: member.employmentType,
        salary: member.salary,
        status: member.status,
        hireDateText: member.hireDateText,
      };
      const result = evaluateRule(memberInput, conditions);
      lastResult = result;
      if (result.eligible) break;
    }
    setEvalResult((prev) => ({ ...prev, [planId]: lastResult }));
  }

  function parseConditions(conditionsJson: string): RuleCondition[] {
    try {
      return JSON.parse(conditionsJson) ?? [];
    } catch {
      return [];
    }
  }

  const operatorLabel: Record<string, string> = {
    equals: "=",
    gte: "≥",
    lte: "≤",
    in: "in",
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Plan Configuration"
        subtitle="Configure insurance plans and eligibility rules"
        action={
          canEdit ? (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
              style={{ background: "#2F80ED" }}
              data-ocid="plan.primary_button"
            >
              <Plus className="w-4 h-4" /> Add Plan
            </button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <Spinner />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "Plan Name",
                  "GI Limit",
                  "Coverage Type",
                  "Coverage Value",
                  "Effective Date",
                  "Version",
                  "Status",
                  "Rules",
                  canEdit ? "Actions" : "",
                  "",
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
              {plans.map((p) => (
                <>
                  <tr
                    key={String(p.id)}
                    className="border-t border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      {formatCurrency(p.giLimit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {p.coverageType.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.coverageType === "flat"
                        ? formatCurrency(p.coverageValue)
                        : `${p.coverageValue}x salary`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.effectiveDateText}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      v{String(p.version)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      {planDynamicRules(p.id).length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 font-medium">
                          {planDynamicRules(p.id).length} rule
                          {planDynamicRules(p.id).length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                          data-ocid="plan.edit_button"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            expanded === String(p.id) ? null : String(p.id),
                          )
                        }
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        data-ocid="plan.toggle"
                      >
                        {expanded === String(p.id) ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {expanded === String(p.id) && (
                    <tr
                      key={`rules-${String(p.id)}`}
                      className="bg-blue-50/20 border-t border-gray-100"
                    >
                      <td colSpan={10} className="px-6 py-4">
                        {/* Old static eligibility rules */}
                        {planRules(p.id).length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-500 mb-1">
                              Legacy Eligibility Rules
                            </p>
                            {planRules(p.id).map((r) => (
                              <div
                                key={String(r.id)}
                                className="flex gap-4 text-xs text-gray-600"
                              >
                                <span>
                                  Allowed types:{" "}
                                  {r.allowedEmploymentTypes.join(", ")}
                                </span>
                                <span>
                                  Waiting period: {String(r.waitingPeriodDays)}{" "}
                                  days
                                </span>
                                <StatusBadge
                                  status={r.active ? "active" : "inactive"}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Dynamic Rule Management */}
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-gray-700">
                            Eligibility Rules
                          </p>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openRuleBuilder(p.id, p.name)}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-white font-medium"
                              style={{ background: "#2F80ED" }}
                              data-ocid="plan.open_modal_button"
                            >
                              <Plus className="w-3 h-3" /> Add Rule
                            </button>
                          )}
                        </div>

                        {planDynamicRules(p.id).length === 0 ? (
                          <div
                            className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg"
                            data-ocid="plan.empty_state"
                          >
                            No rules configured.{" "}
                            {canEdit ? "Click 'Add Rule' to get started." : ""}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-gray-100 overflow-hidden mb-4">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {[
                                    "Rule Name",
                                    "Conditions",
                                    "Status",
                                    ...(canEdit ? ["Actions"] : []),
                                  ].map((h) => (
                                    <th
                                      key={h}
                                      className="text-left text-xs font-semibold text-gray-500 px-3 py-2"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {planDynamicRules(p.id).map((dr, drIdx) => {
                                  const conds = parseConditions(
                                    dr.conditionsJson,
                                  );
                                  return (
                                    <tr
                                      key={String(dr.id)}
                                      className="border-t border-gray-50 hover:bg-gray-50/50"
                                      data-ocid={`plan.rule.item.${drIdx + 1}`}
                                    >
                                      <td className="px-3 py-2 text-sm font-medium text-gray-800">
                                        {dr.name}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1">
                                          {conds.map((c, ci) => (
                                            <span
                                              key={`${c.field}-${c.operator}-${c.value}-${ci}`}
                                              className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-mono"
                                            >
                                              {c.field}{" "}
                                              {operatorLabel[c.operator] ??
                                                c.operator}{" "}
                                              {c.value}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <StatusBadge
                                          status={
                                            dr.active ? "active" : "inactive"
                                          }
                                        />
                                      </td>
                                      {canEdit && (
                                        <td className="px-3 py-2">
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openRuleBuilder(
                                                  p.id,
                                                  p.name,
                                                  dr,
                                                )
                                              }
                                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                                              data-ocid={`plan.rule.edit_button.${drIdx + 1}`}
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => deleteRule(dr.id)}
                                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                              data-ocid={`plan.rule.delete_button.${drIdx + 1}`}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Test Eligibility Panel */}
                        <div className="border border-gray-100 rounded-lg">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg"
                            onClick={() => toggleTestPanel(String(p.id))}
                            data-ocid="plan.toggle"
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <FlaskConical className="w-3 h-3" /> Test
                              Eligibility
                            </span>
                            {testExpanded[String(p.id)] ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                          {testExpanded[String(p.id)] && (
                            <div className="px-3 pb-3 space-y-3">
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <label
                                    htmlFor={`member-select-${String(p.id)}`}
                                    className="block text-xs font-medium text-gray-600 mb-1"
                                  >
                                    Select Member
                                  </label>
                                  <select
                                    id={`member-select-${String(p.id)}`}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
                                    value={selectedMember[String(p.id)] ?? ""}
                                    onChange={(e) =>
                                      setSelectedMember((prev) => ({
                                        ...prev,
                                        [String(p.id)]: e.target.value,
                                      }))
                                    }
                                    data-ocid="plan.select"
                                  >
                                    <option value="">
                                      -- Select a member --
                                    </option>
                                    {members.map((m) => (
                                      <option
                                        key={String(m.id)}
                                        value={String(m.id)}
                                      >
                                        {m.firstName} {m.lastName} (
                                        {m.employmentType})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => runEvaluation(String(p.id))}
                                  disabled={!selectedMember[String(p.id)]}
                                  className="px-3 py-1.5 text-xs text-white rounded-lg disabled:opacity-40"
                                  style={{ background: "#2F80ED" }}
                                  data-ocid="plan.secondary_button"
                                >
                                  Evaluate
                                </button>
                              </div>
                              {evalResult[String(p.id)] && (
                                <div
                                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                                    evalResult[String(p.id)]?.eligible
                                      ? "bg-green-50 border border-green-100"
                                      : "bg-red-50 border border-red-100"
                                  }`}
                                  data-ocid="plan.success_state"
                                >
                                  <span
                                    className={`text-sm font-bold ${
                                      evalResult[String(p.id)]?.eligible
                                        ? "text-green-700"
                                        : "text-red-700"
                                    }`}
                                  >
                                    {evalResult[String(p.id)]?.eligible
                                      ? "✓ ELIGIBLE"
                                      : "✗ NOT ELIGIBLE"}
                                  </span>
                                  <span
                                    className={`text-xs ${
                                      evalResult[String(p.id)]?.eligible
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {evalResult[String(p.id)]?.reason}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                    data-ocid="plan.empty_state"
                  >
                    No plans configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Plan Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            data-ocid="plan.modal"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                {editing ? "Edit Plan" : "Add Plan"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
                data-ocid="plan.close_button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label
                  htmlFor="pc-name"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Plan Name
                </label>
                <input
                  id="pc-name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-ocid="plan.input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="pc-gi-limit"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    GI Limit ($)
                  </label>
                  <input
                    id="pc-gi-limit"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    type="number"
                    value={form.giLimit}
                    onChange={(e) =>
                      setForm({ ...form, giLimit: Number(e.target.value) })
                    }
                    data-ocid="plan.input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pc-coverage-type"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Coverage Type
                  </label>
                  <select
                    id="pc-coverage-type"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    value={form.coverageType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        coverageType: e.target.value as CoverageType,
                      })
                    }
                    data-ocid="plan.select"
                  >
                    <option value="flat">Flat Amount</option>
                    <option value="salary_multiple">Salary Multiple</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="pc-coverage-value"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    {form.coverageType === "flat"
                      ? "Coverage Amount ($)"
                      : "Salary Multiple (x)"}
                  </label>
                  <input
                    id="pc-coverage-value"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    type="number"
                    value={form.coverageValue}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        coverageValue: Number(e.target.value),
                      })
                    }
                    data-ocid="plan.input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pc-effective-date"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Effective Date
                  </label>
                  <input
                    id="pc-effective-date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    type="date"
                    value={form.effectiveDateText}
                    onChange={(e) =>
                      setForm({ ...form, effectiveDateText: e.target.value })
                    }
                    data-ocid="plan.input"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
                  data-ocid="plan.cancel_button"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white rounded-lg"
                  style={{ background: "#2F80ED" }}
                  data-ocid="plan.submit_button"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Update Plan"
                      : "Create Plan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rule Builder Modal */}
      {showRuleBuilder && (
        <EligibilityRuleBuilder
          planId={ruleBuilderPlanId}
          planName={ruleBuilderPlanName}
          editingRule={editingRule}
          onSave={handleRuleSaved}
          onClose={() => setShowRuleBuilder(false)}
          canEdit={canEdit}
        />
      )}
    </PageWrapper>
  );
}
