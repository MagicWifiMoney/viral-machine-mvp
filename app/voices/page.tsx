import { AdminLogin } from "@/components/AdminLogin";
import { TopNav } from "@/components/TopNav";
import { VoiceStudio } from "@/components/VoiceStudio";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VoicesPage() {
  const isAdmin = await isAdminAuthenticated();

  if (!isAdmin) {
    return (
      <main>
        <h1>Voice Studio</h1>
        <AdminLogin title="Voice Studio Login" />
      </main>
    );
  }

  return (
    <main>
      <h1>Voice Studio</h1>
      <TopNav />
      <VoiceStudio />
    </main>
  );
}
