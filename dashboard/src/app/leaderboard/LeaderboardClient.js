"use client";

import { useState } from "react";
import { Search, Trophy, Medal, SearchCode, CheckCircle, HelpCircle } from "lucide-react";

export default function LeaderboardClient({ initialUsers }) {
  const [search, setSearch] = useState("");

  const filteredUsers = initialUsers.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      (user.discordId && user.discordId.includes(q)) ||
      (user.twitter && user.twitter.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative max-w-md w-full">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          placeholder="Search by username, Discord ID, or Twitter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-indigo-950/40 bg-[#0d0d1b]/40 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans"
        />
      </div>

      {/* Leaderboard Table Container */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-indigo-950/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-indigo-950/40 bg-[#080814] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4 text-center w-20">Rank</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4 text-right">Raid Points</th>
                <th className="px-6 py-4 text-center">Approved Raids</th>
                <th className="px-6 py-4 text-center">Submitted Raids</th>
                <th className="px-6 py-4">Twitter Handle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/15">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, idx) => {
                  const rank = idx + 1;
                  
                  // Top 3 highlighting classes
                  let rankCell = <span className="text-sm font-bold text-slate-400">#{rank}</span>;
                  let rowClass = "hover:bg-indigo-950/10 transition-colors";
                  
                  if (rank === 1) {
                    rowClass = "bg-gradient-to-r from-amber-500/5 to-transparent hover:from-amber-500/10 transition-colors border-l-2 border-amber-500";
                    rankCell = (
                      <span className="flex items-center justify-center text-amber-400" title="1st Place (Gold)">
                        <Trophy className="w-5.5 h-5.5 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                      </span>
                    );
                  } else if (rank === 2) {
                    rowClass = "bg-gradient-to-r from-slate-400/5 to-transparent hover:from-slate-400/10 transition-colors border-l-2 border-slate-400";
                    rankCell = (
                      <span className="flex items-center justify-center text-slate-300" title="2nd Place (Silver)">
                        <Medal className="w-5.5 h-5.5 filter drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]" />
                      </span>
                    );
                  } else if (rank === 3) {
                    rowClass = "bg-gradient-to-r from-amber-700/5 to-transparent hover:from-amber-700/10 transition-colors border-l-2 border-amber-700";
                    rankCell = (
                      <span className="flex items-center justify-center text-amber-600" title="3rd Place (Bronze)">
                        <Medal className="w-5.5 h-5.5 filter drop-shadow-[0_0_8px_rgba(180,83,9,0.3)]" />
                      </span>
                    );
                  }

                  return (
                    <tr key={user._id} className={rowClass}>
                      <td className="px-6 py-4 text-center">{rankCell}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-200">{user.username}</span>
                          <span className="text-[10px] text-slate-500">{user.discordId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-amber-400 text-sm">
                        {user.points.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-cyan-400 font-semibold">
                        {user.raidsApproved ?? 0}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-slate-400">
                        {user.raidsSubmitted ?? 0}
                      </td>
                      <td className="px-6 py-4">
                        {user.twitter ? (
                          <a
                            href={`https://x.com/${user.twitter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors hover:underline"
                          >
                            @{user.twitter}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600 italic">Not connected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <SearchCode className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-sm font-semibold">No members match your search</p>
                    <p className="text-xs text-slate-600 mt-1">Try another search query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
