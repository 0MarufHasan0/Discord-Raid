"use client";

import { useState } from "react";
import { Coins, CheckCircle, Clock, XCircle, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

// Local SVG Twitter bird icon to ensure zero dependency version conflicts
const Twitter = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

export default function ProfileClient({ initialUser, raids, claims, discordInfo }) {
  const [user, setUser] = useState(initialUser || { points: 0, raidsSubmitted: 0, raidsApproved: 0, twitter: "" });
  const [twitterHandle, setTwitterHandle] = useState(user.twitter || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const approvalRate = user.raidsSubmitted > 0 
    ? Math.round((user.raidsApproved / user.raidsSubmitted) * 100) 
    : 0;

  const handleSaveTwitter = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/user/twitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitter: twitterHandle.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser((prev) => ({ ...prev, twitter: data.twitter }));
        setMessage({ text: "Twitter handle updated successfully!", type: "success" });
      } else {
        setMessage({ text: data.error || "Failed to update Twitter handle.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "An error occurred. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* User Branding and Basic Stats Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            {discordInfo?.avatarUrl && (
              <img 
                src={discordInfo.avatarUrl} 
                alt="Discord Avatar" 
                className="w-16 h-16 rounded-full border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] object-cover" 
              />
            )}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/30 border border-indigo-900/40 px-3 py-1 rounded-full">
                Member Profile
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold font-outfit text-white">
                Hello, {user.username}
              </h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 mt-1.5 font-semibold">
                <span>ID: {user.discordId}</span>
                {discordInfo?.joinDate && (
                  <>
                    <span>•</span>
                    <span>Joined Guild: {new Date(discordInfo.joinDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/25 px-5 py-2.5 rounded-2xl">
            <Coins className="w-6 h-6 text-amber-400 animate-pulse" />
            <div className="text-left">
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold leading-none">Your Balance</p>
              <p className="text-xl font-extrabold font-outfit text-amber-400 mt-1 tracking-wide">{(user.points ?? 0).toLocaleString()} PTS</p>
            </div>
          </div>
        </div>

        {/* Live Discord server roles listing */}
        {discordInfo?.discordRoles && discordInfo.discordRoles.length > 0 && (
          <div className="mt-6 pt-6 border-t border-indigo-950/30">
            <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest mb-3">Active Server Roles</p>
            <div className="flex flex-wrap gap-2">
              {discordInfo.discordRoles.map(role => (
                <span
                  key={role.id}
                  style={{ borderColor: `${role.color}33`, color: role.color, backgroundColor: `${role.color}0a` }}
                  className="text-[9px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-300 hover:brightness-110 shadow-sm"
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 border-t border-indigo-950/40 mt-8 pt-8 text-center md:text-left">
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Submitted</p>
            <p className="text-xl md:text-2xl font-extrabold text-slate-300 mt-1">{user.raidsSubmitted ?? 0}</p>
          </div>
          <div className="border-x border-indigo-950/20">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Approved</p>
            <p className="text-xl md:text-2xl font-extrabold text-cyan-400 mt-1">{user.raidsApproved ?? 0}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Approval Rate</p>
            <p className="text-xl md:text-2xl font-extrabold text-indigo-400 mt-1">{approvalRate}%</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Settings and Claims */}
        <div className="space-y-8 lg:col-span-1">
          {/* Twitter Settings */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            className="glass-panel p-6 rounded-2xl border border-indigo-950/20"
          >
            <h2 className="text-base font-extrabold font-outfit text-slate-200 mb-4 flex items-center space-x-2">
              <Twitter className="w-5 h-5 text-indigo-400" />
              <span>Twitter Account</span>
            </h2>
            
            <form onSubmit={handleSaveTwitter} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  X.com Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 text-xs font-semibold">
                    @
                  </span>
                  <input
                    type="text"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    placeholder="username"
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0d0d1b]/40 text-xs font-semibold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {message.text && (
                <div className={`p-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center space-x-2 ${
                  message.type === "success" 
                    ? "bg-emerald-950/20 border border-emerald-500/20 text-emerald-400" 
                    : "bg-rose-950/20 border border-rose-500/20 text-rose-400"
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{message.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-[10px] font-extrabold uppercase tracking-widest text-white transition-all duration-300 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                <span>Save Handle</span>
              </button>
            </form>
          </motion.div>

          {/* Active Claims List */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
            className="glass-panel p-6 rounded-2xl border border-indigo-950/20"
          >
            <h2 className="text-base font-extrabold font-outfit text-slate-200 mb-4">
              Claimed Rewards
            </h2>
            
            {claims.length > 0 ? (
              <div className="space-y-3">
                {claims.map((claim) => {
                  const daysLeft = Math.ceil((new Date(claim.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={claim._id} className="p-3.5 rounded-xl border border-indigo-950/30 bg-[#0c0c17]/65 flex flex-col justify-between gap-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-slate-200">{claim.itemName}</span>
                        <span className="text-[9px] text-slate-500 font-semibold">
                          {new Date(claim.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-indigo-950/20 pt-2 text-[9px] font-bold uppercase tracking-wider">
                        <span className="text-slate-500">Validity:</span>
                        <span className={`font-extrabold ${daysLeft > 3 ? "text-cyan-400" : "text-rose-400"}`}>
                          {daysLeft > 0 ? `${daysLeft} days` : "Expired"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider italic text-center py-6">
                No active rewards claimed yet.
              </p>
            )}
          </motion.div>
        </div>

        {/* Right Column: Raid Submission History (Table) */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
          className="lg:col-span-2 space-y-6"
        >
          <h2 className="text-xl font-extrabold font-outfit text-slate-100 flex items-center space-x-2">
            <span>Raid History</span>
          </h2>

          <div className="glass-panel rounded-2xl overflow-hidden border border-indigo-950/25 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-indigo-950/45 bg-[#080814] text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Raid Target</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Points</th>
                    <th className="px-6 py-4">Proof Link</th>
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
                  {raids.length > 0 ? (
                    raids.map((raid) => {
                      let statusBadge = (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-950/20 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>Pending</span>
                        </span>
                      );
                      
                      if (raid.status === "approved") {
                        statusBadge = (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Approved</span>
                          </span>
                        );
                      } else if (raid.status === "rejected") {
                        statusBadge = (
                          <span
                            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider cursor-help"
                            title={raid.rejectedReason || "No reason provided"}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejected</span>
                          </span>
                        );
                      }

                      return (
                        <motion.tr 
                          key={raid._id}
                          variants={{
                            hidden: { opacity: 0, y: 10 },
                            show: { opacity: 1, y: 0 }
                          }}
                          transition={{ type: "spring", stiffness: 260, damping: 22 }}
                          className="hover:bg-indigo-950/15 transition-all duration-300"
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-300 truncate max-w-xs font-semibold">
                                {raid.tweetId ? `Tweet ID: ${raid.tweetId}` : "Custom Submission"}
                              </span>
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                {new Date(raid.submittedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">{statusBadge}</td>
                          <td className="px-6 py-4 text-right font-extrabold text-amber-400 text-xs">
                            +{raid.points ?? 1} PTS
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={raid.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all hover:underline flex items-center space-x-1"
                            >
                              <span>View Proof</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
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
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-500 text-[10px] font-bold uppercase tracking-wider italic">
                        No recent raid submissions found. Join active targets on the home page!
                      </td>
                    </motion.tr>
                  )}
                </motion.tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
