import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type RoleTab = "client" | "agent" | "admin";

export const ROLE_TABS: { role: RoleTab; label: string }[] = [
  { role: "client", label: "مستورد" },
  { role: "agent", label: "مورد" },
  { role: "admin", label: "الإدارة" },
];

const ROLE_EMAILS: Record<RoleTab, string> = {
  client: "client@example.com",
  agent: "agent@example.com",
  admin: "admin@example.com",
};

// Per CLAUDE.md T2.1: the submit button takes the selected role's own
// color — importer navy for client, supplier emerald for agent, slate for
// admin — so switching tabs visibly changes the CTA, not just the copy.
export const SUBMIT_BUTTON_CLASSES: Record<RoleTab, string> = {
  client: "bg-importer-500 hover:bg-importer-600",
  agent: "bg-supplier-500 hover:bg-supplier-600",
  admin: "bg-slate-800 hover:bg-slate-900",
};

/** Shared state/logic behind the desktop and mobile LoginPage layouts. */
export function useLoginForm() {
  const { login } = useAuth();
  const [activeRole, setActiveRole] = useState<RoleTab>("client");
  const [email, setEmail] = useState("client@example.com");
  const [password, setPassword] = useState("Demo@123456!");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleRoleSelect = (role: RoleTab) => {
    setActiveRole(role);
    setEmail(ROLE_EMAILS[role]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
    } catch { /* handled by useAuth toast */ }
    finally { setLoading(false); }
  };

  return {
    activeRole,
    handleRoleSelect,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    showPw,
    setShowPw,
    handleSubmit,
  };
}
