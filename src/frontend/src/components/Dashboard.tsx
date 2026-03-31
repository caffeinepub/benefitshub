import { DollarSign, FileCheck, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "../App";
import type {
  BillingRecord,
  Enrollment,
  EoiRequest,
  Member,
} from "../backend.d";
import { backend } from "../lib/backend";
import {
  KpiCard,
  PageHeader,
  PageWrapper,
  StatusBadge,
  formatCurrency,
} from "./shared";

let seeded = false;

export function Dashboard({ user }: { user: AuthUser }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [eoiRequests, setEoiRequests] = useState<EoiRequest[]>([]);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!seeded) {
        try {
          await backend.seed();
        } catch {}
        seeded = true;
      }
      try {
        const [m, e, eoi, b] = await Promise.all([
          backend.getAllMembers(),
          backend.getAllEnrollments(),
          backend.getAllEoiRequests(),
          backend.getAllBillingRecords(),
        ]);
        setMembers(m);
        setEnrollments(e);
        setEoiRequests(eoi);
        setBilling(b);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeEnrollments = enrollments.filter(
    (e) => e.status === "active",
  ).length;
  const pendingEoi = eoiRequests.filter(
    (e) => e.status === "pending" || e.status === "in_review",
  ).length;
  const totalPremium = billing.reduce((sum, b) => sum + b.premium, 0);

  const recentActivity = [
    {
      text: "New member enrolled: Alice Johnson",
      time: "2h ago",
      type: "enrollment",
    },
    {
      text: "EOI case #3 approved by underwriter",
      time: "4h ago",
      type: "eoi",
    },
    { text: "Invoice INV-2024-001 issued", time: "6h ago", type: "billing" },
    { text: "Plan 'Enhanced Life' updated v2", time: "1d ago", type: "plan" },
    { text: "New member added: Bob Smith", time: "1d ago", type: "member" },
  ];

  return (
    <PageWrapper>
      <PageHeader
        title="Dashboard Overview"
        subtitle={`Welcome back, ${user.name} — Group benefits management`}
      />

      {loading ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 h-28 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Total Members"
            value={members.length}
            sub="Across all employers"
            color="#2F80ED"
          />
          <KpiCard
            label="Active Enrollments"
            value={activeEnrollments}
            sub={`${enrollments.length} total`}
            color="#19A974"
          />
          <KpiCard
            label="EOI Pending"
            value={pendingEoi}
            sub={`${eoiRequests.length} total cases`}
            color="#F59E0B"
          />
          <KpiCard
            label="Monthly Premium"
            value={formatCurrency(totalPremium)}
            sub="All active plans"
            color="#8B5CF6"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.map((a, i) => (
              <div key={`${a.text}-${i}`} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="w-3 h-3 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-700">{a.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enrollment Summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Enrollment Overview
          </h3>
          {loading ? (
            <div className="h-32 bg-gray-50 rounded animate-pulse" />
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: "Active",
                  count: enrollments.filter((e) => e.status === "active")
                    .length,
                  color: "bg-green-500",
                },
                {
                  label: "EOI Pending",
                  count: enrollments.filter((e) => e.status === "eoi_pending")
                    .length,
                  color: "bg-yellow-500",
                },
                {
                  label: "Terminated",
                  count: enrollments.filter((e) => e.status === "terminated")
                    .length,
                  color: "bg-gray-300",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-800">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className={`h-2 rounded-full ${item.color}`}
                      style={{
                        width: enrollments.length
                          ? `${(item.count / enrollments.length) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EOI Workflow */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            EOI Workflow Tracking
          </h3>
          {loading ? (
            <div className="h-32 bg-gray-50 rounded animate-pulse" />
          ) : (
            <div className="space-y-2.5">
              {(["pending", "in_review", "approved", "declined"] as const).map(
                (status) => (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-600 capitalize">
                      {status.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800">
                        {eoiRequests.filter((e) => e.status === status).length}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {/* Members preview table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">
            Recent Members
          </h3>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">
              {members.length} total
            </span>
          </div>
        </div>
        {loading ? (
          <div className="h-32 bg-gray-50 rounded animate-pulse" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {["Name", "Employment Type", "Hire Date", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-gray-500 px-3 py-2 first:rounded-l-lg last:rounded-r-lg"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 5).map((m) => (
                <tr key={String(m.id)} className="border-t border-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        {m.firstName[0]}
                        {m.lastName[0]}
                      </div>
                      <span className="text-sm text-gray-800">
                        {m.firstName} {m.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {m.employmentType.replace("_", " ")}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {m.hireDateText}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageWrapper>
  );
}
