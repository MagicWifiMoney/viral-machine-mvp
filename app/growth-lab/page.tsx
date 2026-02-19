import { AdminLogin } from "@/components/AdminLogin";
import { GrowthLabControls } from "@/components/GrowthLabControls";
import { TopNav } from "@/components/TopNav";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GrowthLabPage() {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return (
      <main>
        <h1>Growth Lab</h1>
        <AdminLogin title="Growth Lab Login" />
      </main>
    );
  }

  return (
    <main>
      <h1>Growth Lab</h1>
      <TopNav />
      <GrowthLabControls />
    </main>
  );
}
