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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#06060c] text-slate-100 font-sans radial-bg">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
