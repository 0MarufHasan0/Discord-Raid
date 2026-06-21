"use client";

import { useState } from "react";
import { Coins, CheckCircle, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react";


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
    <div className="space-y-8">
      {/* User Branding and Basic Stats Card */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
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
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/45 border border-indigo-900/50 px-3 py-1 rounded-full">
                Member Profile
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold font-outfit text-white">
                Hello, {user.username}
              </h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1.5">
                <span>ID: {user.discordId}</span>
                {discordInfo?.joinDate && (
                  <>
                    <span>•</span>
                    <span>Joined Server: {new Date(discordInfo.joinDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/25 px-5 py-2.5 rounded-2xl">
            <Coins className="w-6 h-6 text-amber-400" />
            <div className="text-left">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold leading-none">Your Balance</p>
              <p className="text-xl font-bold font-outfit text-amber-400 mt-1">{(user.points ?? 0).toLocaleString()} pts</p>
            </div>
          </div>
        </div>

        {/* Live Discord server roles listing */}
        {discordInfo?.discordRoles && discordInfo.discordRoles.length > 0 && (
          <div className="mt-6 pt-6 border-t border-indigo-950/30">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2.5">Active Server Roles</p>
            <div className="flex flex-wrap gap-2">
              {discordInfo.discordRoles.map(role => (
                <span
                  key={role.id}
                  style={{ borderColor: `${role.color}33`, color: role.color, backgroundColor: `${role.color}0d` }}
                  className="text-[9px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-300 hover:brightness-110"
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
        )}


        <div className="grid grid-cols-3 gap-4 border-t border-indigo-950/40 mt-8 pt-8">
          <div className="text-center md:text-left">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Submitted</p>
            <p className="text-xl md:text-2xl font-bold text-slate-300 mt-1">{user.raidsSubmitted ?? 0}</p>
          </div>
          <div className="text-center md:text-left border-x border-indigo-950/30">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Approved</p>
            <p className="text-xl md:text-2xl font-bold text-cyan-400 mt-1">{user.raidsApproved ?? 0}</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Approval Rate</p>
            <p className="text-xl md:text-2xl font-bold text-indigo-400 mt-1">{approvalRate}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Settings and Claims */}
        <div className="space-y-8 lg:col-span-1">
          {/* Twitter Settings */}
          <div className="glass-panel p-6 rounded-2xl border border-indigo-950/20">
            <h2 className="text-lg font-bold font-outfit text-slate-200 mb-4 flex items-center space-x-2">
              <Twitter className="w-5 h-5 text-indigo-400" />
              <span>Twitter Account</span>
            </h2>
            
            <form onSubmit={handleSaveTwitter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  X.com Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    placeholder="username"
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-indigo-950/40 bg-[#0d0d1b]/40 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
              </div>

              {message.text && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                  message.type === "success" 
                    ? "bg-emerald-950/30 border border-emerald-500/20 text-emerald-400" 
                    : "bg-rose-950/30 border border-rose-500/20 text-rose-400"
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{message.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Username</span>
              </button>
            </form>
          </div>

          {/* Active Claims List */}
          <div className="glass-panel p-6 rounded-2xl border border-indigo-950/20">
            <h2 className="text-lg font-bold font-outfit text-slate-200 mb-4">
              Claimed Rewards
            </h2>
            
            {claims.length > 0 ? (
              <div className="space-y-3">
                {claims.map((claim) => {
                  const daysLeft = Math.ceil((new Date(claim.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={claim._id} className="p-3.5 rounded-xl border border-indigo-950/40 bg-[#0c0c17]/65 flex flex-col justify-between gap-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-slate-200">{claim.itemName}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(claim.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-indigo-950/20 pt-2 text-[10px]">
                        <span className="text-slate-500">Expires in:</span>
                        <span className={`font-semibold ${daysLeft > 3 ? "text-cyan-400" : "text-rose-400"}`}>
                          {daysLeft > 0 ? `${daysLeft} days` : "Expired"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic text-center py-6">
                No active whitelists or roles claimed yet.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Raid Submission History (Table) */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold font-outfit text-slate-100 flex items-center space-x-2">
            <span>Raid History</span>
          </h2>

          <div className="glass-panel rounded-2xl overflow-hidden border border-indigo-950/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-indigo-950/40 bg-[#080814] text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Tweet target</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Points</th>
                    <th className="px-6 py-4">Submission Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-950/15">
                  {raids.length > 0 ? (
                    raids.map((raid) => {
                      let statusBadge = (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-950/30 border border-amber-500/20 text-amber-400 text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      );
                      
                      if (raid.status === "approved") {
                        statusBadge = (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        );
                      } else if (raid.status === "rejected") {
                        statusBadge = (
                          <span
                            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-rose-950/30 border border-rose-500/20 text-rose-400 text-xs font-medium cursor-help"
                            title={raid.rejectedReason || "No reason provided"}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Rejected</span>
                          </span>
                        );
                      }

                      return (
                        <tr key={raid._id} className="hover:bg-indigo-950/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-300 truncate max-w-xs font-sans">
                                {raid.tweetId ? `Tweet ID: ${raid.tweetId}` : "Custom Submission"}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(raid.submittedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">{statusBadge}</td>
                          <td className="px-6 py-4 text-right font-semibold text-amber-400 text-xs">
                            +{raid.points ?? 1}
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={raid.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors hover:underline"
                            >
                              View Submission
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-500 text-xs italic">
                        No recent raid submissions found. Join active targets on the home page!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
