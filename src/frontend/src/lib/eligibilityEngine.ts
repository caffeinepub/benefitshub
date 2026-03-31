export type RuleOperator = "equals" | "gte" | "lte" | "in";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: string;
}

export interface MemberInput {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  employmentType?: string;
  salary?: number;
  status?: string;
  hireDateText?: string;
}

export interface EvalResult {
  eligible: boolean;
  reason: string;
  failedCondition?: RuleCondition;
}

function getFieldValue(
  member: MemberInput,
  field: string,
): string | number | undefined {
  return (member as Record<string, string | number | undefined>)[field];
}

function evaluateCondition(
  member: MemberInput,
  condition: RuleCondition,
): boolean {
  const raw = getFieldValue(member, condition.field);
  if (raw === undefined || raw === null) return false;
  const memberVal = String(raw);

  switch (condition.operator) {
    case "equals":
      return memberVal.toLowerCase() === condition.value.toLowerCase();
    case "gte": {
      const numMember = Number.parseFloat(memberVal);
      const numCond = Number.parseFloat(condition.value);
      return (
        !Number.isNaN(numMember) &&
        !Number.isNaN(numCond) &&
        numMember >= numCond
      );
    }
    case "lte": {
      const numMember = Number.parseFloat(memberVal);
      const numCond = Number.parseFloat(condition.value);
      return (
        !Number.isNaN(numMember) &&
        !Number.isNaN(numCond) &&
        numMember <= numCond
      );
    }
    case "in": {
      const allowed = condition.value
        .split(",")
        .map((v) => v.trim().toLowerCase());
      return allowed.includes(memberVal.toLowerCase());
    }
    default:
      return false;
  }
}

export function evaluateRule(
  member: MemberInput,
  conditions: RuleCondition[],
): EvalResult {
  if (conditions.length === 0) {
    return { eligible: false, reason: "No conditions defined" };
  }
  for (const condition of conditions) {
    if (!evaluateCondition(member, condition)) {
      return {
        eligible: false,
        reason: `Condition failed: ${condition.field} ${condition.operator} ${condition.value}`,
        failedCondition: condition,
      };
    }
  }
  return {
    eligible: true,
    reason: `All ${conditions.length} condition${conditions.length === 1 ? "" : "s"} passed`,
  };
}

export const SAMPLE_REQUEST = {
  member: {
    firstName: "Jane",
    lastName: "Doe",
    employmentType: "full_time",
    salary: 75000,
    status: "active",
  },
  conditions: [
    { field: "employmentType", operator: "equals", value: "full_time" },
    { field: "salary", operator: "gte", value: "50000" },
  ],
};

export const SAMPLE_RESPONSE = {
  eligible: true,
  reason: "All 2 conditions passed",
};
