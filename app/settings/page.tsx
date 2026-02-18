import { AdminLogin } from "@/components/AdminLogin";
import { TopNav } from "@/components/TopNav";
import { WorkflowSettings } from "@/components/WorkflowSettings";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const isAdmin = await isAdminAuthenticated();

  if (!isAdmin) {
    return (
      <main>
        <h1>Settings</h1>
        <AdminLogin title="Settings Login" />
      </main>
    );
  }

  return (
    <main>
      <h1>Settings</h1>
      <TopNav />
      <WorkflowSettings />
    </main>
  );
}
