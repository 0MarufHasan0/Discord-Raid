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
    <header className="sticky top-0 z-50 w-full border-b border-indigo-950/40 bg-[#06060c]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent tracking-wide font-outfit">
                CHESS RAID
              </span>
              <span className="hidden sm:inline-block text-xs uppercase tracking-widest px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-950/30 font-medium">
                DAO
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                pathname === "/"
                  ? "text-indigo-400 bg-indigo-950/20"
                  : "text-slate-300 hover:text-indigo-300"
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
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "text-indigo-400 bg-indigo-950/30 border-b-2 border-indigo-500/50"
                      : "text-slate-300 hover:text-indigo-300 hover:bg-slate-900/30"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Admin tab */}
            {session?.user?.isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  pathname.startsWith("/admin")
                    ? "text-purple-400 bg-purple-950/30 border-b-2 border-purple-500/50"
                    : "text-slate-300 hover:text-purple-300 hover:bg-slate-900/30"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Panel</span>
              </Link>
            )}
          </nav>

          {/* User Section */}
          <div className="hidden md:flex items-center space-x-4">
            {session ? (
              <div className="flex items-center space-x-3 bg-indigo-950/15 border border-indigo-950/40 px-3 py-1.5 rounded-full">
                <div className="flex items-center space-x-1 text-indigo-300 text-sm font-semibold">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>{session.user.points ?? 0} pts</span>
                </div>
                <div className="h-4 w-px bg-indigo-950/55" />
                <span className="text-sm font-medium text-slate-200">
                  {session.user.username}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-1 rounded-full text-slate-400 hover:text-rose-400 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("discord")}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all duration-300"
              >
                <LogIn className="w-4 h-4" />
                <span>Login with Discord</span>
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-900/50"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a0a14] border-b border-indigo-950/50 px-2 pt-2 pb-4 space-y-1">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === "/" ? "text-indigo-400 bg-indigo-950/20" : "text-slate-300"
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
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium ${
                  pathname === item.path ? "text-indigo-400 bg-indigo-950/30" : "text-slate-300"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          {session?.user?.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium ${
                pathname.startsWith("/admin") ? "text-purple-400 bg-purple-950/30" : "text-slate-300"
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Admin Panel</span>
            </Link>
          )}

          <div className="pt-4 pb-2 border-t border-indigo-950/40 px-3">
            {session ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">
                    {session.user.username}
                  </span>
                  <div className="flex items-center space-x-1 text-indigo-300 text-sm font-semibold">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>{session.user.points} pts</span>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-md border border-rose-500/30 text-rose-400 text-sm font-medium hover:bg-rose-950/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("discord")}
                className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-md bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Login with Discord</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
