"use client";

import { useState } from "react";
import { Search, Trophy, Medal, SearchCode } from "lucide-react";
import { motion } from "framer-motion";

export default function LeaderboardClient({ initialUsers }) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  const handleSearchChange = (val) => {
    setSearch(val);
    setVisibleCount(50);
  };

  const filteredUsers = initialUsers.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      (user.discordId && user.discordId.includes(q)) ||
      (user.twitter && user.twitter.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Search Input Container */}
      <div className="relative max-w-md w-full group">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Search by username, Discord ID, or Twitter..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 rounded-full border border-indigo-950/40 bg-[#0d0d1b]/40 text-xs font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans"
        />
      </div>

      {/* Leaderboard Table Container */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-indigo-950/25 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-indigo-950/45 bg-[#080814] text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-4 sm:px-6 py-4 text-center w-16 sm:w-24">Rank</th>
                <th className="px-4 sm:px-6 py-4">Raider</th>
                <th className="px-4 sm:px-6 py-4 text-right">Raid Points</th>
                <th className="hidden sm:table-cell px-6 py-4 text-center">Approved</th>
                <th className="hidden md:table-cell px-6 py-4 text-center">Submitted</th>
                <th className="hidden md:table-cell px-6 py-4">Twitter Account</th>
              </tr>
            </thead>
            <motion.tbody 
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.04
                  }
                }
              }}
              className="divide-y divide-indigo-950/15"
            >
              {filteredUsers.length > 0 ? (
                filteredUsers.slice(0, visibleCount).map((user, idx) => {
                  const rank = idx + 1;
                  
                  // Top 3 highlighting classes
                  let rankCell = <span className="text-xs font-extrabold text-slate-500">#{rank}</span>;
                  let rowClass = "hover:bg-indigo-950/15 transition-all duration-300";
                  let initialColor = "bg-indigo-950/60 text-indigo-400 border border-indigo-500/20";
                  
                  if (rank === 1) {
                    rowClass = "bg-gradient-to-r from-amber-500/5 via-amber-500/[0.01] to-transparent hover:from-amber-500/10 transition-all duration-300 border-l-2 border-amber-500";
                    rankCell = (
                      <span className="flex items-center justify-center text-amber-400" title="1st Place (Gold)">
                        <Trophy className="w-5 h-5 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-bounce" />
                      </span>
                    );
                    initialColor = "bg-amber-950/40 text-amber-400 border border-amber-500/30";
                  } else if (rank === 2) {
                    rowClass = "bg-gradient-to-r from-slate-400/5 via-slate-400/[0.01] to-transparent hover:from-slate-400/10 transition-all duration-300 border-l-2 border-slate-400";
                    rankCell = (
                      <span className="flex items-center justify-center text-slate-300" title="2nd Place (Silver)">
                        <Medal className="w-5 h-5 filter drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]" />
                      </span>
                    );
                    initialColor = "bg-slate-900/60 text-slate-300 border border-slate-700/50";
                  } else if (rank === 3) {
                    rowClass = "bg-gradient-to-r from-amber-800/5 via-amber-800/[0.01] to-transparent hover:from-amber-800/10 transition-all duration-300 border-l-2 border-amber-700";
                    rankCell = (
                      <span className="flex items-center justify-center text-amber-600" title="3rd Place (Bronze)">
                        <Medal className="w-5 h-5 filter drop-shadow-[0_0_8px_rgba(180,83,9,0.3)]" />
                      </span>
                    );
                    initialColor = "bg-amber-950/20 text-amber-700 border border-amber-800/20";
                  }

                  const firstLetter = (user.username || 'U').charAt(0).toUpperCase();

                  return (
                    <motion.tr 
                      key={user._id}
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        show: { opacity: 1, y: 0 }
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      className={rowClass}
                    >
                      <td className="px-4 sm:px-6 py-4 text-center">{rankCell}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${initialColor}`}>
                            {firstLetter}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-200">{user.username}</span>
                            <span className="hidden sm:inline-block text-[9px] text-slate-500 font-semibold tracking-wider">ID: {user.discordId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-extrabold text-amber-400 text-xs tracking-wider text-glow-amber">
                        {user.points.toLocaleString()}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-center text-xs text-cyan-400 font-bold">
                        {user.raidsApproved ?? 0}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-center text-xs text-slate-500 font-semibold">
                        {user.raidsSubmitted ?? 0}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4">
                        {user.twitter ? (
                          <a
                            href={`https://x.com/${user.twitter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all hover:underline"
                          >
                            @{user.twitter}
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic font-semibold">Not connected</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <motion.tr
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1 }
                  }}
                >
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <SearchCode className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-xs font-bold text-slate-300">No members match your search</p>
                    <p className="text-[10px] text-slate-600 mt-1">Try another search query.</p>
                  </td>
                </motion.tr>
              )}
            </motion.tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length > visibleCount && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + 50)}
            className="px-6 py-2.5 rounded-full border border-indigo-500/20 bg-indigo-950/10 hover:bg-indigo-950/30 text-xs font-bold text-indigo-300 transition-all cursor-pointer hover:border-indigo-400/40"
          >
            Load More Raiders
          </button>
        </div>
      )}
    </div>
  );
}
