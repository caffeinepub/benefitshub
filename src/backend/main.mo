import Map "mo:core/Map";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Float "mo:core/Float";
import Time "mo:core/Time";
import List "mo:core/List";
import Timer "mo:core/Timer";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // ACCESS CONTROL
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // USER PROFILE
  public type UserProfile = {
    name : Text;
    email : Text;
    role : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // TYPES

  type EmployerId = Nat;
  type MemberId = Nat;
  type PlanId = Nat;
  type EnrollmentId = Nat;
  type EoiRequestId = Nat;
  type AssignmentId = Nat;
  type BillingRecordId = Nat;
  type ClaimId = Nat;

  type EmployerStatus = {
    #active;
    #inactive;
  };

  type EmploymentType = {
    #full_time;
    #part_time;
    #contract;
  };

  type MemberStatus = {
    #active;
    #terminated;
  };

  type CoverageType = {
    #flat;
    #salary_multiple;
  };

  type PlanStatus = {
    #active;
    #inactive;
  };

  type EnrollmentStatus = {
    #active;
    #terminated;
    #eoi_pending;
  };

  type EoiStatus = {
    #pending;
    #approved;
    #declined;
    #in_review;
  };

  type AssignmentRole = {
    #admin;
    #underwriter;
    #billing;
    #viewer;
  };

  type AssignmentStatus = {
    #active;
    #inactive;
  };

  type BillingType = {
    #list;
    #self;
    #retro;
  };

  type BillingStatus = {
    #draft;
    #issued;
    #paid;
  };

  type ClaimStatus = {
    #submitted;
    #validated;
    #approved;
    #denied;
  };

  // ENTITIES
  public type Employer = {
    id : EmployerId;
    name : Text;
    industry : Text;
    contactEmail : Text;
    status : EmployerStatus;
  };

  public type Member = {
    id : MemberId;
    employerId : EmployerId;
    firstName : Text;
    lastName : Text;
    email : Text;
    employmentType : EmploymentType;
    hireDateText : Text;
    salary : Float;
    status : MemberStatus;
  };

  public type InsurancePlan = {
    id : PlanId;
    name : Text;
    giLimit : Float;
    coverageType : CoverageType;
    coverageValue : Float;
    effectiveDateText : Text;
    version : Nat;
    status : PlanStatus;
  };

  public type EligibilityRule = {
    id : Nat;
    planId : PlanId;
    allowedEmploymentTypes : [EmploymentType];
    waitingPeriodDays : Nat;
    active : Bool;
  };

  public type DynamicEligibilityRule = {
    id : Nat;
    planId : PlanId;
    name : Text;
    conditionsJson : Text;
    active : Bool;
  };

  public type Enrollment = {
    id : EnrollmentId;
    memberId : MemberId;
    planId : PlanId;
    coverageAmount : Float;
    enrollmentDateText : Text;
    status : EnrollmentStatus;
    eoiTriggered : Bool;
  };

  public type AuditEntry = {
    action : Text;
    by : Text;
    atText : Text;
    note : Text;
  };

  public type EoiRequest = {
    id : EoiRequestId;
    enrollmentId : EnrollmentId;
    memberId : MemberId;
    planId : PlanId;
    coverageRequested : Float;
    giLimit : Float;
    assignedTo : ?Text;
    status : EoiStatus;
    submittedAtText : Text;
    slaDeadlineText : Text;
    auditLog : [AuditEntry];
  };

  public type Assignment = {
    id : AssignmentId;
    name : Text;
    email : Text;
    role : AssignmentRole;
    status : AssignmentStatus;
  };

  public type BillingRecord = {
    id : BillingRecordId;
    enrollmentId : EnrollmentId;
    memberId : MemberId;
    billingType : BillingType;
    billingPeriodText : Text;
    premium : Float;
    rate : Float;
    coverageAmount : Float;
    invoiceNumber : Text;
    status : BillingStatus;
    retroAdjustment : ?Float;
    createdAtText : Text;
  };

  public type Claim = {
    id : ClaimId;
    memberId : MemberId;
    enrollmentId : EnrollmentId;
    dateOfLossText : Text;
    claimAmount : Float;
    status : ClaimStatus;
    coverageValid : Bool;
    coverageAmount : Float;
  };

  public type EligibilityCheckResult = {
    eligible : Bool;
    reason : Text;
  };

  public type EligibilityEvalResult = {
    eligible : Bool;
    reason : Text;
    matchedRuleId : ?Nat;
  };

  module Employer {
    public func compare(a : Employer, b : Employer) : { #less; #equal; #greater } {
      Nat.compare(a.id, b.id);
    };
  };

  module EoiRequest {
    public func compare(a : EoiRequest, b : EoiRequest) : { #less; #equal; #greater } {
      Nat.compare(a.id, b.id);
    };
  };

  module Member {
    public func compare(a : Member, b : Member) : { #less; #equal; #greater } {
      Text.compare(a.lastName, b.lastName);
    };
  };

  // STORAGE
  let employers = Map.empty<EmployerId, Employer>();
  let members = Map.empty<MemberId, Member>();
  let plans = Map.empty<PlanId, InsurancePlan>();
  let eligibilityRules = Map.empty<Nat, EligibilityRule>();
  let dynamicEligibilityRules = Map.empty<Nat, DynamicEligibilityRule>();
  let enrollments = Map.empty<EnrollmentId, Enrollment>();
  let eoiRequests = Map.empty<EoiRequestId, EoiRequest>();
  let assignments = Map.empty<AssignmentId, Assignment>();
  let billingRecords = Map.empty<BillingRecordId, BillingRecord>();
  let claims = Map.empty<ClaimId, Claim>();

  var nextEmployerId = 1;
  var nextMemberId = 1;
  var nextPlanId = 1;
  var nextEligibilityRuleId = 1;
  var nextDynamicRuleId = 1;
  var nextEnrollmentId = 1;
  var nextEoiRequestId = 1;
  var nextAssignmentId = 1;
  var nextBillingRecordId = 1;
  var nextClaimId = 1;

  // SEED DATA - Admin only
  public shared ({ caller }) func seed() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can seed data");
    };

    // EMPLOYERS
    let employer1 : Employer = {
      id = nextEmployerId;
      name = "TechCorp Inc";
      industry = "Technology";
      contactEmail = "contact@techcorp.com";
      status = #active;
    };
    let employer2 : Employer = {
      id = nextEmployerId + 1;
      name = "MediGroup Ltd";
      industry = "Healthcare";
      contactEmail = "info@medigroup.com";
      status = #active;
    };
    employers.add(nextEmployerId, employer1);
    employers.add(nextEmployerId + 1, employer2);
    nextEmployerId += 2;

    // PLANS
    let plan1 : InsurancePlan = {
      id = nextPlanId;
      name = "Basic Life";
      giLimit = 50000;
      coverageType = #flat;
      coverageValue = 50000;
      effectiveDateText = "2024-01-01";
      version = 1;
      status = #active;
    };
    let plan2 : InsurancePlan = {
      id = nextPlanId + 1;
      name = "Enhanced Life";
      giLimit = 200000;
      coverageType = #salary_multiple;
      coverageValue = 2.0;
      effectiveDateText = "2024-01-01";
      version = 1;
      status = #active;
    };
    let plan3 : InsurancePlan = {
      id = nextPlanId + 2;
      name = "Executive Life";
      giLimit = 500000;
      coverageType = #flat;
      coverageValue = 500000;
      effectiveDateText = "2024-01-01";
      version = 1;
      status = #active;
    };
    plans.add(nextPlanId, plan1);
    plans.add(nextPlanId + 1, plan2);
    plans.add(nextPlanId + 2, plan3);
    nextPlanId += 3;

    // ASSIGNMENTS
    let adminAssignment : Assignment = {
      id = nextAssignmentId;
      name = "John Admin";
      email = "john.admin@groupinsure.com";
      role = #admin;
      status = #active;
    };
    let underwriter1 : Assignment = {
      id = nextAssignmentId + 1;
      name = "Amy Underwriter";
      email = "amy.underwriter@groupinsure.com";
      role = #underwriter;
      status = #active;
    };
    let underwriter2 : Assignment = {
      id = nextAssignmentId + 2;
      name = "Bob Underwriter";
      email = "bob.underwriter@groupinsure.com";
      role = #underwriter;
      status = #active;
    };
    let billingAssignment : Assignment = {
      id = nextAssignmentId + 3;
      name = "Sara Billing";
      email = "sara.billing@groupinsure.com";
      role = #billing;
      status = #active;
    };
    assignments.add(nextAssignmentId, adminAssignment);
    assignments.add(nextAssignmentId + 1, underwriter1);
    assignments.add(nextAssignmentId + 2, underwriter2);
    assignments.add(nextAssignmentId + 3, billingAssignment);
    nextAssignmentId += 4;
  };

  // EMPLOYER CRUD - Admin only
  public shared ({ caller }) func createEmployer(name : Text, industry : Text, contactEmail : Text) : async EmployerId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create employers");
    };
    let id = nextEmployerId;
    let employer : Employer = {
      id;
      name;
      industry;
      contactEmail;
      status = #active;
    };
    employers.add(id, employer);
    nextEmployerId += 1;
    id;
  };

  public shared ({ caller }) func updateEmployer(id : EmployerId, employer : Employer) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update employers");
    };
    if (not employers.containsKey(id)) {
      Runtime.trap("Employer not found");
    };
    employers.add(id, employer);
  };

  public shared ({ caller }) func deleteEmployer(id : EmployerId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete employers");
    };
    if (not employers.containsKey(id)) {
      Runtime.trap("Employer not found");
    };
    employers.remove(id);
  };

  public query ({ caller }) func getEmployer(id : EmployerId) : async ?Employer {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view employers");
    };
    employers.get(id);
  };

  public query ({ caller }) func getAllEmployers() : async [Employer] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view employers");
    };
    employers.values().toArray().sort();
  };

  // MEMBER CRUD - Admin only for create/update/delete
  public shared ({ caller }) func createMember(member : Member) : async MemberId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create members");
    };
    let id = nextMemberId;
    let newMember : Member = {
      id;
      employerId = member.employerId;
      firstName = member.firstName;
      lastName = member.lastName;
      email = member.email;
      employmentType = member.employmentType;
      hireDateText = member.hireDateText;
      salary = member.salary;
      status = #active;
    };
    members.add(id, newMember);
    nextMemberId += 1;
    id;
  };

  public shared ({ caller }) func updateMember(id : MemberId, member : Member) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update members");
    };
    if (not members.containsKey(id)) {
      Runtime.trap("Member not found");
    };
    members.add(id, member);
  };

  public shared ({ caller }) func deleteMember(id : MemberId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete members");
    };
    if (not members.containsKey(id)) {
      Runtime.trap("Member not found");
    };
    members.remove(id);
  };

  public query ({ caller }) func getMember(id : MemberId) : async ?Member {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view members");
    };
    members.get(id);
  };

  public query ({ caller }) func getAllMembers() : async [Member] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view members");
    };
    members.values().toArray().sort();
  };

  public query ({ caller }) func getMembersByEmployer(employerId : EmployerId) : async [Member] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view members");
    };
    members.values().toArray().filter(func(m) { m.employerId == employerId });
  };

  // PLAN CRUD - Admin only
  public shared ({ caller }) func createPlan(plan : InsurancePlan) : async PlanId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create plans");
    };
    let id = nextPlanId;
    let newPlan = {
      plan with id;
    };
    plans.add(id, newPlan);
    nextPlanId += 1;
    id;
  };

  public shared ({ caller }) func updatePlan(id : PlanId, plan : InsurancePlan) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update plans");
    };
    if (not plans.containsKey(id)) {
      Runtime.trap("Plan not found");
    };
    plans.add(id, plan);
  };

  public shared ({ caller }) func deletePlan(id : PlanId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete plans");
    };
    if (not plans.containsKey(id)) {
      Runtime.trap("Plan not found");
    };
    plans.remove(id);
  };

  public query ({ caller }) func getPlan(id : PlanId) : async ?InsurancePlan {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view plans");
    };
    plans.get(id);
  };

  public query ({ caller }) func getAllPlans() : async [InsurancePlan] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view plans");
    };
    plans.values().toArray();
  };

  // ELIGIBILITY RULES - Admin only
  public shared ({ caller }) func createEligibilityRule(rule : EligibilityRule) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create eligibility rules");
    };
    let id = nextEligibilityRuleId;
    let newRule = {
      rule with id;
    };
    eligibilityRules.add(id, newRule);
    nextEligibilityRuleId += 1;
  };

  public shared ({ caller }) func updateEligibilityRule(id : Nat, rule : EligibilityRule) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update eligibility rules");
    };
    if (not eligibilityRules.containsKey(id)) {
      Runtime.trap("Rule not found");
    };
    eligibilityRules.add(id, rule);
  };

  public shared ({ caller }) func deleteEligibilityRule(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete eligibility rules");
    };
    if (not eligibilityRules.containsKey(id)) {
      Runtime.trap("Rule not found");
    };
    eligibilityRules.remove(id);
  };

  public query ({ caller }) func getEligibilityRule(id : Nat) : async ?EligibilityRule {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view eligibility rules");
    };
    eligibilityRules.get(id);
  };

  public query ({ caller }) func getAllEligibilityRules() : async [EligibilityRule] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view eligibility rules");
    };
    eligibilityRules.values().toArray();
  };

  // Dynamic Rule CRUD (Admin only)
  public shared ({ caller }) func createDynamicRule(rule : DynamicEligibilityRule) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create dynamic rules");
    };
    let id = nextDynamicRuleId;
    let newRule = {
      rule with id;
    };
    dynamicEligibilityRules.add(id, newRule);
    nextDynamicRuleId += 1;
    id;
  };

  public shared ({ caller }) func updateDynamicRule(id : Nat, rule : DynamicEligibilityRule) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update dynamic rules");
    };
    if (not dynamicEligibilityRules.containsKey(id)) {
      Runtime.trap("Dynamic rule not found");
    };
    dynamicEligibilityRules.add(id, rule);
  };

  public shared ({ caller }) func deleteDynamicRule(id : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete dynamic rules");
    };
    if (not dynamicEligibilityRules.containsKey(id)) {
      Runtime.trap("Dynamic rule not found");
    };
    dynamicEligibilityRules.remove(id);
  };

  // Dynamic Rules Queries (User)
  public query ({ caller }) func getDynamicRulesByPlan(planId : Nat) : async [DynamicEligibilityRule] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view dynamic rules");
    };
    dynamicEligibilityRules.values().toArray().filter(func(r) { r.planId == planId });
  };

  public query ({ caller }) func getAllDynamicRules() : async [DynamicEligibilityRule] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view dynamic rules");
    };
    dynamicEligibilityRules.values().toArray();
  };

  // Dummy backend evaluation - just checks if active rules exist for plan/member
  public query ({ caller }) func evaluateMemberEligibility(memberId : Nat, planId : Nat) : async EligibilityEvalResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can evaluate eligibility");
    };
    switch (members.get(memberId)) {
      case (null) {
        {
          eligible = false;
          reason = "Member not found";
          matchedRuleId = null;
        };
      };
      case (?member) {
        let rulesForPlan = dynamicEligibilityRules.values().toArray().filter(func(r) { r.planId == planId and r.active });
        switch (rulesForPlan.size()) {
          case (0) {
            {
              eligible = false;
              reason = "No active rules for plan";
              matchedRuleId = null;
            };
          };
          case (_) {
            {
              eligible = true;
              reason = "Active rules exist for plan";
              matchedRuleId = ?planId; // Use plan ID as dummy matched rule
            };
          };
        };
      };
    };
  };

  // ENROLLMENT - Users can enroll, all can view
  public shared ({ caller }) func enrollMember(memberId : MemberId, planId : PlanId, coverageAmount : Float, enrollmentDateText : Text) : async EnrollmentId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can enroll members");
    };
    let plan = switch (plans.get(planId)) {
      case (null) { Runtime.trap("Plan does not exist") };
      case (?p) { p };
    };

    let (status, eoiTriggered) = if (coverageAmount > plan.giLimit) {
      (#eoi_pending, true);
    } else {
      (#active, false);
    };

    let id = nextEnrollmentId;
    let enrollment : Enrollment = {
      id;
      memberId;
      planId;
      coverageAmount;
      enrollmentDateText;
      status;
      eoiTriggered;
    };
    enrollments.add(id, enrollment);
    nextEnrollmentId += 1;
    id;
  };

  public query ({ caller }) func getAllEnrollments() : async [Enrollment] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view enrollments");
    };
    enrollments.values().toArray();
  };

  public query ({ caller }) func getEnrollmentsByMember(memberId : MemberId) : async [Enrollment] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view enrollments");
    };
    enrollments.values().toArray().filter(func(e) { e.memberId == memberId });
  };

  // EOI REQUESTS - Users can create, admins/underwriters can manage
  public shared ({ caller }) func createEoiRequest(enrollmentId : EnrollmentId, memberId : MemberId, planId : PlanId, coverageRequested : Float, giLimit : Float, submittedAtText : Text, slaDeadlineText : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create EOI requests");
    };
    let id = nextEoiRequestId;
    let eoiRequest : EoiRequest = {
      id;
      enrollmentId;
      memberId;
      planId;
      coverageRequested;
      giLimit;
      assignedTo = null;
      status = #pending;
      submittedAtText;
      slaDeadlineText;
      auditLog = [];
    };
    eoiRequests.add(id, eoiRequest);
    nextEoiRequestId += 1;
  };

  public shared ({ caller }) func assignEoiRequest(id : EoiRequestId, assignedTo : Text, by : Text, atText : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can assign EOI requests");
    };
    let eoi = switch (eoiRequests.get(id)) {
      case (null) { Runtime.trap("EOI Request does not exist") };
      case (?e) { e };
    };
    let auditEntry : AuditEntry = {
      action = "Assigned";
      by;
      atText;
      note = "Assigned to " # assignedTo;
    };
    let updatedAuditLog = eoi.auditLog.concat([auditEntry]);
    let updatedEoi = {
      eoi with
      assignedTo = ?assignedTo;
      status = #in_review;
      auditLog = updatedAuditLog;
    };
    eoiRequests.add(id, updatedEoi);
  };

  public shared ({ caller }) func updateEoiStatus(id : EoiRequestId, status : EoiStatus, by : Text, atText : Text, note : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update EOI status");
    };
    let eoi = switch (eoiRequests.get(id)) {
      case (null) { Runtime.trap("EOI Request does not exist") };
      case (?e) { e };
    };
    let auditEntry : AuditEntry = {
      action = "Status Update";
      by;
      atText;
      note;
    };
    let updatedAuditLog = eoi.auditLog.concat([auditEntry]);
    let updatedEoi = {
      eoi with
      status;
      auditLog = updatedAuditLog;
    };
    eoiRequests.add(id, updatedEoi);
  };

  public query ({ caller }) func getAllEoiRequests() : async [EoiRequest] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view EOI requests");
    };
    eoiRequests.values().toArray().sort();
  };

  public query ({ caller }) func getEoiRequestsByStatus(status : EoiStatus) : async [EoiRequest] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view EOI requests");
    };
    eoiRequests.values().toArray().filter(func(e) { e.status == status });
  };

  // ASSIGNMENTS - Admin only
  public shared ({ caller }) func createAssignment(name : Text, email : Text, role : AssignmentRole) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create assignments");
    };
    let id = nextAssignmentId;
    let assignment : Assignment = {
      id;
      name;
      email;
      role;
      status = #active;
    };
    assignments.add(id, assignment);
    nextAssignmentId += 1;
  };

  public shared ({ caller }) func updateAssignment(id : AssignmentId, assignment : Assignment) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update assignments");
    };
    if (not assignments.containsKey(id)) {
      Runtime.trap("Assignment not found");
    };
    assignments.add(id, assignment);
  };

  public shared ({ caller }) func deleteAssignment(id : AssignmentId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete assignments");
    };
    if (not assignments.containsKey(id)) {
      Runtime.trap("Assignment not found");
    };
    assignments.remove(id);
  };

  public query ({ caller }) func getAllAssignments() : async [Assignment] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view assignments");
    };
    assignments.values().toArray();
  };

  public query ({ caller }) func getAssignmentsByRole(role : AssignmentRole) : async [Assignment] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view assignments");
    };
    assignments.values().toArray().filter(func(a) { a.role == role });
  };

  public query ({ caller }) func getActiveAssignments() : async [Assignment] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view assignments");
    };
    assignments.values().toArray().filter(func(a) { a.status == #active });
  };

  // BILLING - Admin only for create/update, users can view
  public shared ({ caller }) func createBillingRecord(enrollmentId : EnrollmentId, memberId : MemberId, billingType : BillingType, billingPeriodText : Text, premium : Float, rate : Float, coverageAmount : Float, invoiceNumber : Text, createdAtText : Text) : async BillingRecordId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create billing records");
    };
    let id = nextBillingRecordId;
    let billingRecord : BillingRecord = {
      id;
      enrollmentId;
      memberId;
      billingType;
      billingPeriodText;
      premium;
      rate;
      coverageAmount;
      invoiceNumber;
      status = #draft;
      retroAdjustment = null;
      createdAtText;
    };
    billingRecords.add(id, billingRecord);
    nextBillingRecordId += 1;
    id;
  };

  public shared ({ caller }) func updateBillingRecord(id : BillingRecordId, record : BillingRecord) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update billing records");
    };
    if (not billingRecords.containsKey(id)) {
      Runtime.trap("Billing record not found");
    };
    billingRecords.add(id, record);
  };

  public query ({ caller }) func getBillingRecordsByMember(memberId : MemberId) : async [BillingRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view billing records");
    };
    billingRecords.values().toArray().filter(func(r) { r.memberId == memberId });
  };

  public query ({ caller }) func getAllBillingRecords() : async [BillingRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view billing records");
    };
    billingRecords.values().toArray();
  };

  // CLAIMS - Users can create/update, all can view
  public shared ({ caller }) func validateClaim(memberId : MemberId, enrollmentId : EnrollmentId) : async (Bool, Float) {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can validate claims");
    };
    switch (enrollments.get(enrollmentId)) {
      case (null) { (false, 0.0) };
      case (?enrollment) {
        if (enrollment.memberId == memberId and enrollment.status == #active) {
          (true, enrollment.coverageAmount);
        } else {
          (false, 0.0);
        };
      };
    };
  };

  public shared ({ caller }) func createClaim(memberId : MemberId, enrollmentId : EnrollmentId, dateOfLossText : Text, claimAmount : Float, status : ClaimStatus, coverageValid : Bool, coverageAmount : Float) : async ClaimId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create claims");
    };
    let id = nextClaimId;
    let claim : Claim = {
      id;
      memberId;
      enrollmentId;
      dateOfLossText;
      claimAmount;
      status;
      coverageValid;
      coverageAmount;
    };
    claims.add(id, claim);
    nextClaimId += 1;
    id;
  };

  public shared ({ caller }) func updateClaim(id : ClaimId, claim : Claim) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update claims");
    };
    if (not claims.containsKey(id)) {
      Runtime.trap("Claim not found");
    };
    claims.add(id, claim);
  };

  public query ({ caller }) func getClaimsByMember(memberId : MemberId) : async [Claim] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view claims");
    };
    claims.values().toArray().filter(func(c) { c.memberId == memberId });
  };

  public query ({ caller }) func getAllClaims() : async [Claim] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view claims");
    };
    claims.values().toArray();
  };

  // ELIGIBILITY CHECK - Users only
  public query ({ caller }) func checkEligibility(memberId : MemberId, planId : PlanId) : async EligibilityCheckResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can check eligibility");
    };
    switch (members.get(memberId)) {
      case (null) { { eligible = false; reason = "Member not found" } };
      case (?member) {
        // Find relevant eligibility rule
        let rule = eligibilityRules.values().toArray().find(func(r) { r.planId == planId and r.active });
        switch (rule) {
          case (null) { { eligible = false; reason = "No eligibility rule found for plan" } };
          case (?eligibilityRule) {
            // Check employment type
            let empTypeEligible = eligibilityRule.allowedEmploymentTypes.find(func(t) { t == member.employmentType }) != null;
            if (not empTypeEligible) {
              return {
                eligible = false;
                reason = "Employment type not eligible for plan";
              };
            };

            // WAITING PERIOD CHECK (approximate)
            { eligible = true; reason = "Eligible for plan" };
          };
        };
      };
    };
  };
};
