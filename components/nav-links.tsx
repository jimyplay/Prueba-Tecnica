"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/licitaciones", label: "Licitaciones" },
  { href: "/clientes", label: "Clientes" },
  { href: "/productos", label: "Productos" },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...BASE_LINKS, { href: "/usuarios", label: "Usuarios" }]
    : BASE_LINKS;

  return (
    <>
      {links.map((link) => {
        const isActive =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? "text-sm font-semibold text-gray-900"
                : "text-sm text-gray-600 hover:text-gray-900"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
