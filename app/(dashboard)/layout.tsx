import { getSessionUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLinks } from "@/components/nav-links";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getSessionUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-6">
            <span className="font-semibold text-gray-900">Licitaciones</span>
            <NavLinks isAdmin={usuario.role === "admin"} />
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {usuario.email} ({usuario.role})
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
