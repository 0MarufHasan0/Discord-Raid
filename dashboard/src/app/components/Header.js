"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Shield, Trophy, ShoppingBag, User, LogOut, LogIn, Menu, X, Coins } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "Leaderboard", path: "/leaderboard", icon: Trophy, public: true },
    { name: "Marketplace", path: "/shop", icon: ShoppingBag, public: false },
    { name: "Profile", path: "/profile", icon: User, public: false },
  ];

  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-8 py-4 bg-transparent">
      <div className="max-w-7xl mx-auto floating-header px-6 py-2.5 transition-all duration-300">
        <div className="flex items-center justify-between h-12">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <img src="/logo.jpg" alt="Chess DAO Logo" className="w-8 h-8 rounded-full border border-indigo-500/30 group-hover:border-indigo-400/50 transition-all duration-300 object-cover" />
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent tracking-wide font-outfit group-hover:brightness-110 transition-all duration-300 animate-text-gradient">
                  CHESS RAID
                </span>
                <span className="hidden sm:inline-block text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-950/30 font-bold group-hover:border-indigo-400/50 transition-all duration-300">
                  DAO
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                pathname === "/"
                  ? "text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  : "text-slate-400 hover:text-indigo-300 hover:bg-white/5 border border-transparent"
              }`}
            >
              Home
            </Link>
            
            {navItems.map((item) => {
              // Hide private routes if not logged in
              if (!item.public && !session) return null;
              
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                    isActive
                      ? "text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                      : "text-slate-400 hover:text-indigo-300 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Admin tab */}
            {session?.user?.isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                  pathname.startsWith("/admin")
                    ? "text-purple-300 bg-purple-950/40 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                    : "text-slate-400 hover:text-purple-300 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </Link>
            )}
          </nav>

          {/* User Section */}
          <div className="hidden md:flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-3 bg-white/5 border border-white/5 px-3 py-1.5 rounded-full">
                <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold">
                  <Coins className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>{(session.user.points ?? 0).toLocaleString()} pts</span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-xs font-semibold text-slate-300">
                  {session.user.username}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-1 rounded-full text-slate-500 hover:text-rose-400 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("discord")}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-xs font-bold text-white hover:brightness-110 shadow-[0_0_15px_rgba(99,102,241,0.25)] transition-all duration-300 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login with Discord</span>
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all duration-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 mx-auto floating-header px-4 py-3 space-y-1 animate-fade-in-up">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-semibold ${
              pathname === "/" ? "text-indigo-300 bg-indigo-950/30" : "text-slate-400 hover:text-indigo-300"
            }`}
          >
            Home
          </Link>
          {navItems.map((item) => {
            if (!item.public && !session) return null;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                  pathname === item.path ? "text-indigo-300 bg-indigo-950/30" : "text-slate-400 hover:text-indigo-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          {session?.user?.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                pathname.startsWith("/admin") ? "text-purple-300 bg-purple-950/30" : "text-slate-400"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin Panel</span>
            </Link>
          )}

          <div className="pt-3 mt-3 border-t border-white/5">
            {session ? (
              <div className="space-y-3 px-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    {session.user.username}
                  </span>
                  <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>{(session.user.points ?? 0).toLocaleString()} pts</span>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-950/10 transition-all duration-300 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("discord")}
                className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login with Discord</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
