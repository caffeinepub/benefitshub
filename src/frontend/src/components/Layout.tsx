import {
  Building2,
  ClipboardList,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AppRole, AuthUser, Screen } from "../App";

interface NavItem {
  id: Screen;
  label: string;
  icon: ReactNode;
  roles: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ["admin", "underwriter", "billing", "viewer"],
  },
  {
    id: "members",
    label: "Members",
    icon: <Users className="w-4 h-4" />,
    roles: ["admin", "underwriter"],
  },
  {
    id: "employers",
    label: "Employers",
    icon: <Building2 className="w-4 h-4" />,
    roles: ["admin"],
  },
  {
    id: "enrollment",
    label: "Enrollment",
    icon: <ClipboardList className="w-4 h-4" />,
    roles: ["admin", "underwriter"],
  },
  {
    id: "eoi",
    label: "EOI Workflow",
    icon: <GitBranch className="w-4 h-4" />,
    roles: ["admin", "underwriter"],
  },
  {
    id: "plans",
    label: "Plan Config",
    icon: <Settings className="w-4 h-4" />,
    roles: ["admin"],
  },
  {
    id: "assignments",
    label: "Assignment Master",
    icon: <UserCog className="w-4 h-4" />,
    roles: ["admin"],
  },
  {
    id: "billing",
    label: "Billing",
    icon: <Wallet className="w-4 h-4" />,
    roles: ["admin", "billing"],
  },
];

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-teal-400/20 text-teal-300",
  underwriter: "bg-blue-400/20 text-blue-300",
  billing: "bg-yellow-400/20 text-yellow-300",
  viewer: "bg-gray-400/20 text-gray-300",
};

interface LayoutProps {
  user: AuthUser;
  screen: Screen;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Layout({
  user,
  screen,
  onNavigate,
  onLogout,
  children,
}: LayoutProps) {
  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(user.role));

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F4F7FA" }}
    >
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col h-full"
        style={{
          background:
            "linear-gradient(180deg, #0B2236 0%, #0F3A55 60%, #115B6A 100%)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-teal-400/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-teal-300" />
          </div>
          <div>
            <span className="text-white font-bold text-sm">BenefitsHub</span>
            <p className="text-blue-300/60 text-xs">Insurance Platform</p>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {user.name}
              </p>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[user.role]}`}
              >
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = screen === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
                data-ocid={`nav.${item.id}.link`}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  active
                    ? "bg-teal-400/20 text-teal-300"
                    : "text-blue-200/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.icon}
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={onLogout}
            data-ocid="nav.logout.button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-200/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
