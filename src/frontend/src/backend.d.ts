import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type EoiRequestId = bigint;
export interface EligibilityEvalResult {
    matchedRuleId?: bigint;
    eligible: boolean;
    reason: string;
}
export type EmployerId = bigint;
export interface Enrollment {
    id: EnrollmentId;
    status: EnrollmentStatus;
    memberId: MemberId;
    enrollmentDateText: string;
    eoiTriggered: boolean;
    planId: PlanId;
    coverageAmount: number;
}
export interface Employer {
    id: EmployerId;
    status: EmployerStatus;
    name: string;
    contactEmail: string;
    industry: string;
}
export interface AuditEntry {
    by: string;
    action: string;
    note: string;
    atText: string;
}
export interface InsurancePlan {
    id: PlanId;
    status: PlanStatus;
    coverageValue: number;
    name: string;
    effectiveDateText: string;
    version: bigint;
    giLimit: number;
    coverageType: CoverageType;
}
export interface EligibilityRule {
    id: bigint;
    active: boolean;
    planId: PlanId;
    waitingPeriodDays: bigint;
    allowedEmploymentTypes: Array<EmploymentType>;
}
export type AssignmentId = bigint;
export interface Assignment {
    id: AssignmentId;
    status: AssignmentStatus;
    name: string;
    role: AssignmentRole;
    email: string;
}
export type PlanId = bigint;
export type ClaimId = bigint;
export type EnrollmentId = bigint;
export interface Claim {
    id: ClaimId;
    status: ClaimStatus;
    memberId: MemberId;
    claimAmount: number;
    enrollmentId: EnrollmentId;
    coverageValid: boolean;
    coverageAmount: number;
    dateOfLossText: string;
}
export interface EoiRequest {
    id: EoiRequestId;
    status: EoiStatus;
    memberId: MemberId;
    enrollmentId: EnrollmentId;
    assignedTo?: string;
    planId: PlanId;
    auditLog: Array<AuditEntry>;
    slaDeadlineText: string;
    giLimit: number;
    coverageRequested: number;
    submittedAtText: string;
}
export interface BillingRecord {
    id: BillingRecordId;
    status: BillingStatus;
    memberId: MemberId;
    enrollmentId: EnrollmentId;
    premium: number;
    rate: number;
    createdAtText: string;
    invoiceNumber: string;
    billingPeriodText: string;
    coverageAmount: number;
    retroAdjustment?: number;
    billingType: BillingType;
}
export type MemberId = bigint;
export interface DynamicEligibilityRule {
    id: bigint;
    active: boolean;
    planId: PlanId;
    name: string;
    conditionsJson: string;
}
export type BillingRecordId = bigint;
export interface Member {
    id: MemberId;
    status: MemberStatus;
    salary: number;
    hireDateText: string;
    email: string;
    employmentType: EmploymentType;
    employerId: EmployerId;
    lastName: string;
    firstName: string;
}
export interface EligibilityCheckResult {
    eligible: boolean;
    reason: string;
}
export interface UserProfile {
    name: string;
    role: string;
    email: string;
}
export enum AssignmentRole {
    admin = "admin",
    billing = "billing",
    underwriter = "underwriter",
    viewer = "viewer"
}
export enum BillingStatus {
    paid = "paid",
    issued = "issued",
    draft = "draft"
}
export enum BillingType {
    list = "list",
    self = "self",
    retro = "retro"
}
export enum ClaimStatus {
    submitted = "submitted",
    validated = "validated",
    denied = "denied",
    approved = "approved"
}
export enum CoverageType {
    salary_multiple = "salary_multiple",
    flat = "flat"
}
export enum EmployerStatus {
    active = "active",
    inactive = "inactive"
}
export enum EmploymentType {
    contract = "contract",
    part_time = "part_time",
    full_time = "full_time"
}
export enum EnrollmentStatus {
    active = "active",
    terminated = "terminated",
    eoi_pending = "eoi_pending"
}
export enum EoiStatus {
    pending = "pending",
    in_review = "in_review",
    approved = "approved",
    declined = "declined"
}
export enum MemberStatus {
    active = "active",
    terminated = "terminated"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    assignEoiRequest(id: EoiRequestId, assignedTo: string, by: string, atText: string): Promise<void>;
    checkEligibility(memberId: MemberId, planId: PlanId): Promise<EligibilityCheckResult>;
    createAssignment(name: string, email: string, role: AssignmentRole): Promise<void>;
    createBillingRecord(enrollmentId: EnrollmentId, memberId: MemberId, billingType: BillingType, billingPeriodText: string, premium: number, rate: number, coverageAmount: number, invoiceNumber: string, createdAtText: string): Promise<BillingRecordId>;
    createClaim(memberId: MemberId, enrollmentId: EnrollmentId, dateOfLossText: string, claimAmount: number, status: ClaimStatus, coverageValid: boolean, coverageAmount: number): Promise<ClaimId>;
    createDynamicRule(rule: DynamicEligibilityRule): Promise<bigint>;
    createEligibilityRule(rule: EligibilityRule): Promise<void>;
    createEmployer(name: string, industry: string, contactEmail: string): Promise<EmployerId>;
    createEoiRequest(enrollmentId: EnrollmentId, memberId: MemberId, planId: PlanId, coverageRequested: number, giLimit: number, submittedAtText: string, slaDeadlineText: string): Promise<void>;
    createMember(member: Member): Promise<MemberId>;
    createPlan(plan: InsurancePlan): Promise<PlanId>;
    deleteAssignment(id: AssignmentId): Promise<void>;
    deleteDynamicRule(id: bigint): Promise<void>;
    deleteEligibilityRule(id: bigint): Promise<void>;
    deleteEmployer(id: EmployerId): Promise<void>;
    deleteMember(id: MemberId): Promise<void>;
    deletePlan(id: PlanId): Promise<void>;
    enrollMember(memberId: MemberId, planId: PlanId, coverageAmount: number, enrollmentDateText: string): Promise<EnrollmentId>;
    evaluateMemberEligibility(memberId: bigint, planId: bigint): Promise<EligibilityEvalResult>;
    getActiveAssignments(): Promise<Array<Assignment>>;
    getAllAssignments(): Promise<Array<Assignment>>;
    getAllBillingRecords(): Promise<Array<BillingRecord>>;
    getAllClaims(): Promise<Array<Claim>>;
    getAllDynamicRules(): Promise<Array<DynamicEligibilityRule>>;
    getAllEligibilityRules(): Promise<Array<EligibilityRule>>;
    getAllEmployers(): Promise<Array<Employer>>;
    getAllEnrollments(): Promise<Array<Enrollment>>;
    getAllEoiRequests(): Promise<Array<EoiRequest>>;
    getAllMembers(): Promise<Array<Member>>;
    getAllPlans(): Promise<Array<InsurancePlan>>;
    getAssignmentsByRole(role: AssignmentRole): Promise<Array<Assignment>>;
    getBillingRecordsByMember(memberId: MemberId): Promise<Array<BillingRecord>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getClaimsByMember(memberId: MemberId): Promise<Array<Claim>>;
    getDynamicRulesByPlan(planId: bigint): Promise<Array<DynamicEligibilityRule>>;
    getEligibilityRule(id: bigint): Promise<EligibilityRule | null>;
    getEmployer(id: EmployerId): Promise<Employer | null>;
    getEnrollmentsByMember(memberId: MemberId): Promise<Array<Enrollment>>;
    getEoiRequestsByStatus(status: EoiStatus): Promise<Array<EoiRequest>>;
    getMember(id: MemberId): Promise<Member | null>;
    getMembersByEmployer(employerId: EmployerId): Promise<Array<Member>>;
    getPlan(id: PlanId): Promise<InsurancePlan | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    seed(): Promise<void>;
    updateAssignment(id: AssignmentId, assignment: Assignment): Promise<void>;
    updateBillingRecord(id: BillingRecordId, record: BillingRecord): Promise<void>;
    updateClaim(id: ClaimId, claim: Claim): Promise<void>;
    updateDynamicRule(id: bigint, rule: DynamicEligibilityRule): Promise<void>;
    updateEligibilityRule(id: bigint, rule: EligibilityRule): Promise<void>;
    updateEmployer(id: EmployerId, employer: Employer): Promise<void>;
    updateEoiStatus(id: EoiRequestId, status: EoiStatus, by: string, atText: string, note: string): Promise<void>;
    updateMember(id: MemberId, member: Member): Promise<void>;
    updatePlan(id: PlanId, plan: InsurancePlan): Promise<void>;
    validateClaim(memberId: MemberId, enrollmentId: EnrollmentId): Promise<[boolean, number]>;
}
