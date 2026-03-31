import { useEffect, useState } from "react";
import type { Employer } from "./backend.d";
import { AssignmentMaster } from "./components/AssignmentMaster";
import { BillingView } from "./components/BillingView";
import { Dashboard } from "./components/Dashboard";
import { EmployerMaster } from "./components/EmployerMaster";
import { Enrollment } from "./components/Enrollment";
import { EoiWorkflow } from "./components/EoiWorkflow";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { Members } from "./components/Members";
import { PlanConfiguration } from "./components/PlanConfiguration";
import { backend } from "./lib/backend";

export type AppRole = "admin" | "underwriter" | "billing" | "viewer";
export type Screen =
  | "dashboard"
  | "members"
  | "employers"
  | "enrollment"
  | "eoi"
  | "assignments"
  | "plans"
  | "billing";

export interface AuthUser {
  name: string;
  role: AppRole;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [employers, setEmployers] = useState<Employer[]>([]);

  useEffect(() => {
    backend.getAllEmployers().then(setEmployers).catch(console.error);
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return <Dashboard user={user} />;
      case "members":
        return (
          <Members
            user={user}
            employers={employers}
            setEmployers={setEmployers}
          />
        );
      case "employers":
        return (
          <EmployerMaster
            user={user}
            employers={employers}
            setEmployers={setEmployers}
          />
        );
      case "enrollment":
        return <Enrollment user={user} />;
      case "eoi":
        return <EoiWorkflow user={user} />;
      case "assignments":
        return <AssignmentMaster user={user} />;
      case "plans":
        return <PlanConfiguration user={user} />;
      case "billing":
        return <BillingView user={user} />;
      default:
        return <Dashboard user={user} />;
    }
  };

  return (
    <Layout
      user={user}
      screen={screen}
      onNavigate={setScreen}
      onLogout={() => setUser(null)}
    >
      {renderScreen()}
    </Layout>
  );
}
