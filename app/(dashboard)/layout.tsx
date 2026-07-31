import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/licitaciones", label: "Licitaciones" },
  { href: "/clientes", label: "Clientes" },
  { href: "/productos", label: "Productos" },
];

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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
            {usuario.role === "admin" && (
              <Link
                href="/usuarios"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Usuarios
              </Link>
            )}
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
