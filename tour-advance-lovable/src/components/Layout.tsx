import { Link, useLocation } from "react-router-dom";
import { Music, Settings, ChevronRight } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Layout({ children, breadcrumbs }: LayoutProps) {
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60 px-4 py-3 flex items-center gap-4">
        <Link to="/tours" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center flex-shrink-0">
            <Music size={13} className="text-black" />
          </div>
          <span className="font-bold text-sm text-amber-400 tracking-tight">TAPS</span>
        </Link>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-zinc-500">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-zinc-700" />}
                {crumb.href ? (
                  <Link to={crumb.href} className="hover:text-zinc-300 transition-colors">{crumb.label}</Link>
                ) : (
                  <span className="text-zinc-300 font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto">
          <Link
            to="/settings"
            className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${loc.pathname === "/settings" ? "text-amber-400" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            <Settings size={16} />
          </Link>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
