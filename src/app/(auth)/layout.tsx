import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import PatientNavbar from "@/components/patient/PatientNavbar";
import { SophrologueProvider } from "@/components/providers/SophrologueProvider";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSophrologueSession();

  if (!session) {
    redirect("/connexion");
  }

  if (session.sophrologue) {
    return (
      <SophrologueProvider sophrologue={session.sophrologue}>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar />
          <div className="ml-60 min-w-0 flex-1">{children}</div>
        </div>
      </SophrologueProvider>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PatientNavbar />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
