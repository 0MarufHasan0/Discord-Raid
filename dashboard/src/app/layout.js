import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Chess Raid Dashboard",
  description: "Verify, track points, browse whitelists, and see who dominates the Chess DAO raid leaderboard.",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#030307] text-slate-100 font-sans radial-bg relative overflow-x-hidden">
        {/* Floating background glowing ambient lights */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none animate-float-1 z-0" />
        <div className="absolute bottom-[10%] right-[-10%] w-[45vw] h-[45vw] max-w-[500px] bg-purple-600/6 rounded-full blur-[100px] pointer-events-none animate-float-2 z-0" />
        <div className="absolute top-[40%] left-[60%] w-[35vw] h-[35vw] max-w-[400px] bg-cyan-600/6 rounded-full blur-[90px] pointer-events-none animate-float-3 z-0" />

        <div className="relative z-10 flex flex-col min-h-screen w-full">
          <Providers>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
