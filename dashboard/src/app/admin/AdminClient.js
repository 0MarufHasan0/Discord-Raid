"use client";

import { useState } from "react";
import { 
  Check, X, Trash2, Shield, Plus, Search, 
  Coins, MessageSquare, AlertTriangle, RefreshCw, Send, ShieldCheck,
  Copy, Trophy, Gift
} from "lucide-react";
import { motion } from "framer-motion";

export default function AdminClient({ initialTweets, initialPendingRaids, initialUsers }) {
  const [activeTab, setActiveTab] = useState("submissions");
  const [pendingRaids, setPendingRaids] = useState(initialPendingRaids);
  const [tweets, setTweets] = useState(initialTweets);
  const [users, setUsers] = useState(initialUsers);
  
  // Pending actions states
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectingRaid, setRejectingRaid] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Add Tweet form states
  const [newTweet, setNewTweet] = useState({ tweetId: "", content: "", imageUrl: "", points: 1, postedBy: "ChessDAO" });
  
  // Member edit states
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [adjustPointsValue, setAdjustPointsValue] = useState(0);
  const [pointsAction, setPointsAction] = useState("add"); // "add" or "remove"

  const [message, setMessage] = useState({ text: "", type: "" });

  // Copy Raider & Raffle States
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showRaffleModal, setShowRaffleModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [raffleWinnersCount, setRaffleWinnersCount] = useState(1);
  const [raffleMinPoints, setRaffleMinPoints] = useState(4);
  const [raffleRequireTwitter, setRaffleRequireTwitter] = useState(true);
  const [raffleWinners, setRaffleWinners] = useState([]);
  const [raffleTweetId, setRaffleTweetId] = useState("");
  const [isRaffling, setIsRaffling] = useState(false);

  // Database reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const showStatusMsg = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };


  // 1. Approve Raid
  const handleApproveRaid = async (raidId) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/approve-raid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId }),
      });

      const data = await res.json();
      if (res.ok) {
        setPendingRaids((prev) => prev.filter((r) => r.raidId !== raidId));
        showStatusMsg(`Raid approved! +${data.points} points awarded to user.`, "success");
      } else {
        showStatusMsg(data.error || "Failed to approve raid.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("An error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Reject Raid Submission
  const handleRejectRaid = async () => {
    if (!rejectingRaid) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/reject-raid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          raidId: rejectingRaid.raidId,
          reason: rejectionReason.trim() || "Does not meet raid requirements."
        }),
      });

      if (res.ok) {
        setPendingRaids((prev) => prev.filter((r) => r.raidId !== rejectingRaid.raidId));
        showStatusMsg("Raid submission rejected.", "success");
        setRejectingRaid(null);
        setRejectionReason("");
      } else {
        const data = await res.json();
        showStatusMsg(data.error || "Failed to reject raid.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("An error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Add Tweet Target
  const handleAddTweet = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/add-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTweet),
      });

      const data = await res.json();
      if (res.ok) {
        setTweets((prev) => [data.tweet, ...prev]);
        showStatusMsg("Target tweet successfully posted!", "success");
        setNewTweet({ tweetId: "", content: "", imageUrl: "", points: 1, postedBy: "ChessDAO" });
      } else {
        showStatusMsg(data.error || "Failed to post target tweet.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("An error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Delete Tweet
  const handleDeleteTweet = async (tweetId) => {
    if (!confirm("Are you sure you want to delete this target tweet?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/delete-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetId }),
      });

      if (res.ok) {
        setTweets((prev) => prev.filter((t) => t.tweetId !== tweetId));
        showStatusMsg("Target tweet deleted.", "success");
      } else {
        const data = await res.json();
        showStatusMsg(data.error || "Failed to delete tweet.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("An error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Adjust Member Points manually
  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionLoading(true);
    
    try {
      const res = await fetch("/api/admin/edit-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedMember.discordId,
          amount: Number(adjustPointsValue),
          action: pointsAction
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.discordId === selectedMember.discordId ? { ...u, points: data.newPoints } : u
          )
        );
        showStatusMsg(`Points adjusted successfully! New balance: ${data.newPoints} pts`, "success");
        setSelectedMember(null);
        setAdjustPointsValue(0);
      } else {
        showStatusMsg(data.error || "Failed to adjust points.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("An error occurred.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Delete all data / reset database
  const handleResetDatabase = async () => {
    if (resetConfirmText.trim() !== "I want to Fuck Chess Dao Data Base") {
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/admin/delete-all-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: resetConfirmText.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setTweets([]);
        setPendingRaids([]);
        setUsers((prev) =>
          prev.map((u) => ({
            ...u,
            points: 0,
            raidsSubmitted: 0,
            raidsApproved: 0,
          }))
        );
        showStatusMsg("Database reset successfully! All raid data has been cleared.", "success");
        setShowResetModal(false);
        setResetConfirmText("");
      } else {
        showStatusMsg(data.error || "Failed to reset database.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("An error occurred during database reset.", "error");
    } finally {
      setResetLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    if (allUsers.length > 0) return allUsers;
    setLoadingAllUsers(true);
    try {
      const res = await fetch("/api/admin/all-users");
      const data = await res.json();
      if (res.ok) {
        setAllUsers(data.users);
        return data.users;
      } else {
        showStatusMsg(data.error || "Failed to fetch all users.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("Failed to fetch all users.", "error");
    } finally {
      setLoadingAllUsers(false);
    }
    return [];
  };

  const handleOpenCopyModal = async () => {
    setShowCopyModal(true);
    await fetchAllUsers();
  };

  const handleOpenRaffleModal = async () => {
    setShowRaffleModal(true);
    setRaffleWinners([]);
    setRaffleTweetId("");
    await fetchAllUsers();
  };

  const handleLoadTweetUsers = async () => {
    setLoadingAllUsers(true);
    try {
      const url = raffleTweetId.trim()
        ? `/api/admin/all-users?tweetId=${raffleTweetId.trim()}`
        : "/api/admin/all-users";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAllUsers(data.users);
      } else {
        showStatusMsg(data.error || "Failed to fetch users.", "error");
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("Failed to fetch users.", "error");
    } finally {
      setLoadingAllUsers(false);
    }
  };

  const handleCopyFormat = (format) => {
    let textToCopy = "";
    if (format === "twitter") {
      const twitters = allUsers
        .map((u) => u.twitter?.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("@") ? t : `@${t}`));
      textToCopy = twitters.join("\n");
    } else if (format === "discord") {
      const discords = allUsers
        .map((u) => u.username?.trim())
        .filter(Boolean);
      textToCopy = discords.join("\n");
    } else if (format === "both") {
      textToCopy = allUsers
        .map((u, i) => {
          const twStr = u.twitter ? (u.twitter.startsWith("@") ? u.twitter : `@${u.twitter}`) : "N/A";
          return `${i + 1}. Twitter: ${twStr} | Discord: ${u.username}`;
        })
        .join("\n");
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopyStatus("Copied to clipboard successfully!");
      setTimeout(() => setCopyStatus(""), 3000);
    } else {
      setCopyStatus("No usernames found to copy.");
      setTimeout(() => setCopyStatus(""), 3000);
    }
  };

  const handleRunRaffle = async () => {
    setIsRaffling(true);
    setRaffleWinners([]);

    let targetUsers = allUsers;

    // Fetch latest users dynamically from DB (respecting tweetId if provided)
    try {
      const url = raffleTweetId.trim()
        ? `/api/admin/all-users?tweetId=${raffleTweetId.trim()}`
        : "/api/admin/all-users";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        targetUsers = data.users;
        setAllUsers(data.users); // Sync count in UI
      } else {
        showStatusMsg(data.error || "Failed to fetch users.", "error");
        setIsRaffling(false);
        return;
      }
    } catch (err) {
      console.error(err);
      showStatusMsg("Failed to fetch users.", "error");
      setIsRaffling(false);
      return;
    }

    // Filter eligible users
    const eligible = targetUsers.filter((u) => {
      const matchPoints = u.points >= raffleMinPoints;
      const matchTwitter = !raffleRequireTwitter || u.twitter;
      return matchPoints && matchTwitter;
    });

    if (eligible.length === 0) {
      showStatusMsg("No eligible users found for the raffle.", "error");
      setIsRaffling(false);
      return;
    }

    // Shuffling simulation (delay for nice visual experience)
    setTimeout(() => {
      // Fisher-Yates shuffle
      const shuffled = [...eligible];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Select winners
      const count = Math.min(raffleWinnersCount, shuffled.length);
      const winners = shuffled.slice(0, count);

      setRaffleWinners(winners);
      setIsRaffling(false);
    }, 1200);
  };

  const handleCopyWinners = () => {
    if (raffleWinners.length === 0) return;
    const text = raffleWinners
      .map((w, index) => {
        const tw = w.twitter ? (w.twitter.startsWith("@") ? w.twitter : `@${w.twitter}`) : "N/A";
        const submissionStr = w.submissionLink ? ` | Submission: ${w.submissionLink}` : "";
        return `${index + 1}. Discord: ${w.username} | Twitter: ${tw} (${w.points} pts)${submissionStr}`;
      })
      .join("\n");
    
    navigator.clipboard.writeText(text);
    showStatusMsg("Winners list copied to clipboard!", "success");
  };

  const filteredUsers = users.filter((u) => {
    const q = memberSearch.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.discordId.includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Messages */}
      {message.text && (
        <div className={`p-4 rounded-xl text-sm flex items-center space-x-2 ${
          message.type === "success" 
            ? "bg-emerald-950/40 border border-emerald-500/25 text-emerald-400" 
            : "bg-rose-950/40 border border-rose-500/25 text-rose-400"
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Admin Tab Switchers & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex bg-[#070711]/60 border border-indigo-950/45 p-1 rounded-full w-fit relative border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.15)]">
        <button
          onClick={() => setActiveTab("submissions")}
          className={`px-6 py-2.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 cursor-pointer relative z-10 ${
            activeTab === "submissions"
              ? "text-indigo-300 font-extrabold"
              : "text-slate-500 hover:text-slate-300 font-bold"
          }`}
        >
          <span>Pending ({pendingRaids.length})</span>
          {activeTab === "submissions" && (
            <motion.div
              layoutId="adminActiveTabHighlight"
              className="absolute inset-0 bg-indigo-950/70 border border-indigo-500/20 rounded-full z-[-1] shadow-[0_0_12px_rgba(99,102,241,0.15)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("tweets")}
          className={`px-6 py-2.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 cursor-pointer relative z-10 ${
            activeTab === "tweets"
              ? "text-indigo-300 font-extrabold"
              : "text-slate-500 hover:text-slate-300 font-bold"
          }`}
        >
          <span>Targets ({tweets.length})</span>
          {activeTab === "tweets" && (
            <motion.div
              layoutId="adminActiveTabHighlight"
              className="absolute inset-0 bg-indigo-950/70 border border-indigo-500/20 rounded-full z-[-1] shadow-[0_0_12px_rgba(99,102,241,0.15)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("members")}
          className={`px-6 py-2.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 cursor-pointer relative z-10 ${
            activeTab === "members"
              ? "text-indigo-300 font-extrabold"
              : "text-slate-500 hover:text-slate-300 font-bold"
          }`}
        >
          <span>Members</span>
          {activeTab === "members" && (
            <motion.div
              layoutId="adminActiveTabHighlight"
              className="absolute inset-0 bg-indigo-950/70 border border-indigo-500/20 rounded-full z-[-1] shadow-[0_0_12px_rgba(99,102,241,0.15)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleOpenCopyModal}
          className="px-6 py-2.5 rounded-full border border-indigo-500/20 bg-indigo-950/10 hover:bg-indigo-600/30 text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 hover:text-white transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy Raiders</span>
        </button>
        <button
          type="button"
          onClick={handleOpenRaffleModal}
          className="px-6 py-2.5 rounded-full border border-purple-500/20 bg-purple-950/10 hover:bg-purple-600/30 text-[10px] font-extrabold uppercase tracking-widest text-purple-400 hover:text-white transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Raffle Raider</span>
        </button>
        <button
          onClick={() => setShowResetModal(true)}
          className="px-6 py-2.5 rounded-full border border-rose-500/25 bg-rose-950/10 hover:bg-rose-950/20 text-[10px] font-extrabold uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-all flex items-center space-x-1.5 cursor-pointer glow-card-rose shadow-md"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete All Data</span>
        </button>
      </div>
    </div>

      {/* Tab Contents: 1. Submissions */}
      {activeTab === "submissions" && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl overflow-hidden border border-indigo-950/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-indigo-950/40 bg-[#080814] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Target Tweet ID</th>
                    <th className="px-6 py-4">Submitted At</th>
                    <th className="px-6 py-4">Proof Link</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-950/15">
                  {pendingRaids.length > 0 ? (
                    pendingRaids.map((raid) => (
                      <tr key={raid._id} className="hover:bg-indigo-950/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-200">{raid.username}</span>
                            <span className="text-[10px] text-slate-500">{raid.userId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-indigo-400">
                          {raid.tweetId || "Custom Target"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(raid.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={raid.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline"
                          >
                            Open Link
                          </a>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex space-x-2">
                            <button
                              onClick={() => handleApproveRaid(raid.raidId)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 transition-all"
                              title="Approve Submission"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setRejectingRaid(raid)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all"
                              title="Reject Submission"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500 text-sm italic">
                        No pending raid submissions at the moment. Good job!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: 2. Target Tweets */}
      {activeTab === "tweets" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Tweet form */}
          <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-indigo-950/20 self-start">
            <h3 className="text-lg font-bold font-outfit text-white mb-4 flex items-center space-x-1.5">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Post New Target</span>
            </h3>
            
            <form onSubmit={handleAddTweet} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tweet ID</label>
                <input
                  type="text"
                  required
                  value={newTweet.tweetId}
                  onChange={(e) => setNewTweet({...newTweet, tweetId: e.target.value.trim()})}
                  placeholder="e.g. 1782025385673"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Content Snippet</label>
                <textarea
                  required
                  rows="3"
                  value={newTweet.content}
                  onChange={(e) => setNewTweet({...newTweet, content: e.target.value})}
                  placeholder="Summarize the tweet content..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Image URL (Optional)</label>
                <input
                  type="text"
                  value={newTweet.imageUrl}
                  onChange={(e) => setNewTweet({...newTweet, imageUrl: e.target.value})}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Points Value</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newTweet.points}
                    onChange={(e) => setNewTweet({...newTweet, points: Number(e.target.value)})}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Posted By</label>
                  <input
                    type="text"
                    required
                    value={newTweet.postedBy}
                    onChange={(e) => setNewTweet({...newTweet, postedBy: e.target.value})}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
              >
                Post Target Tweet
              </button>
            </form>
          </div>

          {/* Active tweets table */}
          <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden border border-indigo-950/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-indigo-950/40 bg-[#080814] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Author</th>
                    <th className="px-6 py-4">Tweet ID</th>
                    <th className="px-6 py-4">Content</th>
                    <th className="px-6 py-4 text-center">Reward</th>
                    <th className="px-6 py-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-950/15">
                  {tweets.length > 0 ? (
                    tweets.map((tweet) => (
                      <tr key={tweet._id} className="hover:bg-indigo-950/10 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-200">@{tweet.postedBy}</td>
                        <td className="px-6 py-4 text-xs font-mono text-indigo-400">{tweet.tweetId}</td>
                        <td className="px-6 py-4 text-xs text-slate-400 truncate max-w-[200px]" title={tweet.content}>
                          {tweet.content}
                        </td>
                        <td className="px-6 py-4 text-center text-xs font-bold text-amber-400">+{tweet.points} pts</td>
                        <td className="px-6 py-4 text-right font-semibold">
                          <button
                            onClick={() => handleDeleteTweet(tweet.tweetId)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all"
                            title="Delete Tweet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500 text-sm italic">
                        No active target tweets currently. Post one!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: 3. Member Manager */}
      {activeTab === "members" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Member Point Editor Form */}
          <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-indigo-950/20 self-start">
            <h3 className="text-lg font-bold font-outfit text-white mb-4 flex items-center space-x-1.5">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <span>Modify Points</span>
            </h3>

            {selectedMember ? (
              <form onSubmit={handleAdjustPoints} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-indigo-950/15 border border-indigo-950/40 text-xs">
                  <p className="font-semibold text-slate-200">Selected User: {selectedMember.username}</p>
                  <p className="text-slate-500 mt-0.5">Discord ID: {selectedMember.discordId}</p>
                  <p className="text-amber-400 font-bold mt-2">Current points: {selectedMember.points} pts</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Adjustment Action</label>
                  <select
                    value={pointsAction}
                    onChange={(e) => setPointsAction(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
                  >
                    <option value="add">Add Points (+)</option>
                    <option value="remove">Deduct Points (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Amount</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustPointsValue}
                    onChange={(e) => setAdjustPointsValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="w-1/2 py-2 text-xs font-semibold text-slate-400 bg-slate-900 hover:text-white rounded-lg border border-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-1/2 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                  >
                    Submit Change
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-slate-500 italic py-6 text-center">
                Click "Edit" next to a user in the table on the right to adjust their raid points.
              </p>
            )}
          </div>

          {/* Member List Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search member by username or ID..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-indigo-950/40 bg-[#0d0d1b]/40 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                />
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCopyModal}
                  className="px-4 py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-950/40 hover:bg-indigo-600 text-xs font-semibold text-indigo-300 hover:text-white transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Raiders</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenRaffleModal}
                  className="px-4 py-2.5 rounded-xl border border-purple-500/20 bg-purple-950/40 hover:bg-purple-600 text-xs font-semibold text-purple-300 hover:text-white transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Raffle Raider</span>
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden border border-indigo-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-indigo-950/40 bg-[#080814] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Member</th>
                      <th className="px-6 py-4 text-right">Points</th>
                      <th className="px-6 py-4 text-center">Approved</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-950/15">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((m) => (
                        <tr key={m._id} className="hover:bg-indigo-950/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-200">{m.username}</span>
                              <span className="text-[10px] text-slate-500">{m.discordId}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-bold text-amber-400">
                            {m.points.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center text-xs text-cyan-400 font-semibold">
                            {m.raidsApproved ?? 0}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold">
                            <button
                              onClick={() => setSelectedMember(m)}
                              className="px-3 py-1 text-xs font-semibold text-indigo-400 hover:text-white bg-indigo-950/40 hover:bg-indigo-600 rounded-lg border border-indigo-900/30 transition-all"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500 text-sm italic">
                          No community members match your search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Submission Reason Modal */}
      {rejectingRaid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-indigo-950/50 shadow-2xl">
            <h3 className="text-lg font-bold font-outfit text-white mb-2">
              Reject Submission
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Provide a reason for rejecting the raid submission by <strong className="text-slate-200">{rejectingRaid.username}</strong>.
              This will be visible on their dashboard.
            </p>

            <textarea
              required
              rows="3"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Invalid screenshot proof / Link doesn't point to raid task"
              className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-sm focus:outline-none focus:border-indigo-500 mb-6"
            />

            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => {
                  setRejectingRaid(null);
                  setRejectionReason("");
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 rounded-lg hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRaid}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center space-x-1.5"
              >
                <span>{actionLoading ? "Processing..." : "Reject"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-rose-500/20 shadow-2xl relative">
            <div className="flex items-center space-x-2 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
              <h3 className="text-lg font-extrabold font-outfit text-white">
                Danger Zone: Delete All Data
              </h3>
            </div>
            
            <div className="space-y-4 mb-6">
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                This action is irreversible. The following data will be permanently deleted:
              </p>
              <ul className="list-disc pl-5 text-[11px] text-slate-300 space-y-1 font-medium">
                <li>All raid submission records (<span className="text-rose-400 font-mono">raids</span> collection)</li>
                <li>All posted tweet target announcements (<span className="text-rose-400 font-mono">tweets</span> collection)</li>
                <li>Reset all user points, raidsSubmitted, and raidsApproved to 0 (<span className="text-rose-400 font-mono">users</span> collection)</li>
                <li>All whitelist role expiration tracking (<span className="text-rose-400 font-mono">userroleexpirations</span> collection)</li>
              </ul>
              
              <div className="border-t border-rose-950/20 pt-4">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  To confirm, type <span className="text-rose-400 font-mono font-bold select-all bg-rose-950/20 px-1 rounded">I want to Fuck Chess Dao Data Base</span> below:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type confirmation here..."
                  className="w-full px-3 py-2.5 rounded-lg border border-rose-950/40 bg-[#0c0c16]/50 text-xs font-semibold text-slate-200 placeholder-slate-700 focus:outline-none focus:border-rose-500/50"
                />
              </div>
            </div>

            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText("");
                }}
                disabled={resetLoading}
                className="px-5 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 hover:text-slate-200 bg-white/5 border border-white/5 rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDatabase}
                disabled={resetLoading || resetConfirmText.trim() !== "I want to Fuck Chess Dao Data Base"}
                className={`px-5 py-2 text-[10px] font-extrabold uppercase tracking-widest text-white rounded-full transition-all flex items-center space-x-1.5 cursor-pointer ${
                  resetConfirmText.trim() === "I want to Fuck Chess Dao Data Base"
                    ? "bg-rose-600 hover:bg-rose-500 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                    : "bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                {resetLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{resetLoading ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Raiders Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-indigo-950/50 shadow-2xl">
            <h3 className="text-lg font-bold font-outfit text-white mb-2 flex items-center space-x-2">
              <Copy className="w-5 h-5 text-indigo-400" />
              <span>Copy Raider Usernames</span>
            </h3>
            
            {loadingAllUsers ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-400">Loading all raider data...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Select a copy format to copy all raider details. Total raiders loaded: <strong className="text-slate-200">{allUsers.length}</strong>.
                </p>

                <div className="p-3.5 rounded-xl bg-indigo-950/15 border border-indigo-950/40 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Total Members:</span>
                    <span className="text-slate-200">{allUsers.length}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Twitter Accounts Linked:</span>
                    <span className="text-emerald-400">{allUsers.filter(u => u.twitter).length}</span>
                  </div>
                </div>

                {copyStatus && (
                  <div className="p-2.5 text-center text-xs font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-lg">
                    {copyStatus}
                  </div>
                )}

                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleCopyFormat("twitter")}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex justify-between items-center cursor-pointer"
                  >
                    <span>Copy Twitter Usernames Only</span>
                    <span className="text-[10px] text-indigo-200">(@user)</span>
                  </button>
                  <button
                    onClick={() => handleCopyFormat("discord")}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex justify-between items-center cursor-pointer"
                  >
                    <span>Copy Discord Usernames Only</span>
                    <span className="text-[10px] text-indigo-200">(username)</span>
                  </button>
                  <button
                    onClick={() => handleCopyFormat("both")}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex justify-between items-center cursor-pointer"
                  >
                    <span>Copy Serialized List (Both)</span>
                    <span className="text-[10px] text-indigo-200">(1. Twitter: @x | Discord: y)</span>
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowCopyModal(false);
                      setCopyStatus("");
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 rounded-lg hover:text-slate-200 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raffle Raider Modal */}
      {showRaffleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-indigo-950/50 shadow-2xl text-left">
            <h3 className="text-lg font-bold font-outfit text-white mb-2 flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-purple-400 animate-pulse" />
              <span>Raider Raffle Draw</span>
            </h3>
            
            {loadingAllUsers ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                <p className="text-xs text-slate-400">Loading all raider data...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Select points threshold and number of winners to draw random raiders.
                </p>

                {/* Configuration Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Min Points Target
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={raffleMinPoints}
                      onChange={(e) => {
                        setRaffleMinPoints(Number(e.target.value));
                        setRaffleWinners([]);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Number of Winners
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={raffleWinnersCount}
                      onChange={(e) => {
                        setRaffleWinnersCount(Number(e.target.value));
                        setRaffleWinners([]);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Tweet ID (Optional) - Filter by specific raid participants
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="e.g. 1782025385673 (Leave empty for all users)"
                        value={raffleTweetId}
                        onChange={(e) => {
                          setRaffleTweetId(e.target.value);
                          setRaffleWinners([]);
                        }}
                        className="flex-1 px-3.5 py-2.5 rounded-lg border border-indigo-950/40 bg-[#0c0c16]/50 text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={handleLoadTweetUsers}
                        className="px-4 py-2.5 text-xs font-bold text-indigo-300 bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-500/20 rounded-lg transition-colors cursor-pointer"
                      >
                        Apply Filter
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requireTwitter"
                    checked={raffleRequireTwitter}
                    onChange={(e) => {
                      setRaffleRequireTwitter(e.target.checked);
                      setRaffleWinners([]);
                    }}
                    className="rounded border-indigo-950 bg-[#0c0c16]/50 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <label htmlFor="requireTwitter" className="text-xs text-slate-300 cursor-pointer select-none">
                    Require Twitter handle (Exclude users without Twitter link)
                  </label>
                </div>

                {/* Statistics of Qualified Users */}
                <div className="p-3 py-2 rounded-xl bg-purple-950/10 border border-purple-500/10 flex justify-between items-center">
                  <span className="text-[11px] text-slate-400">Eligible Raiders matching filters:</span>
                  <span className="text-xs font-extrabold text-purple-400">
                    {allUsers.filter(u => u.points >= raffleMinPoints && (!raffleRequireTwitter || u.twitter)).length} users
                  </span>
                </div>

                {/* Shuffling Status / Results */}
                {isRaffling ? (
                  <div className="p-8 text-center space-y-3">
                    <RefreshCw className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-purple-300 animate-pulse">Shuffling and drawing winners...</p>
                  </div>
                ) : raffleWinners.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                      🎉 Raffle Winners ({raffleWinners.length})
                    </h4>
                    <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {raffleWinners.map((winner, index) => (
                        <div
                          key={winner.discordId}
                          className="flex items-center justify-between p-3 rounded-xl bg-purple-950/15 border border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.08)]"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-extrabold text-slate-200">
                              {index + 1}. Discord: {winner.username}
                            </span>
                            <span className="text-[10px] text-purple-400 font-medium mt-0.5">
                              Twitter: {winner.twitter ? (winner.twitter.startsWith("@") ? winner.twitter : `@${winner.twitter}`) : "None"}
                            </span>
                            {winner.submissionLink && (
                              <a
                                href={winner.submissionLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold mt-1 inline-flex items-center"
                              >
                                🔗 Submission Proof
                              </a>
                            )}
                          </div>
                          <span className="text-xs font-bold text-amber-400">
                            {winner.points} pts
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={handleCopyWinners}
                        className="flex-1 py-2 text-xs font-bold text-purple-300 bg-purple-950/30 hover:bg-purple-900/40 rounded-lg border border-purple-500/20 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Winners List</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Footer Buttons */}
                <div className="flex space-x-3 justify-end pt-2 border-t border-indigo-950/20">
                  <button
                    onClick={() => {
                      setShowRaffleModal(false);
                      setRaffleWinners([]);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-900 border border-slate-800 rounded-lg hover:text-slate-200 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleRunRaffle}
                    disabled={isRaffling || allUsers.filter(u => u.points >= raffleMinPoints && (!raffleRequireTwitter || u.twitter)).length === 0}
                    className={`px-5 py-2 text-xs font-extrabold text-white rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                      allUsers.filter(u => u.points >= raffleMinPoints && (!raffleRequireTwitter || u.twitter)).length > 0
                        ? "bg-purple-600 hover:bg-purple-500 hover:shadow-[0_0_12px_rgba(168,85,247,0.35)]"
                        : "bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Gift className="w-4 h-4" />
                    <span>{raffleWinners.length > 0 ? "Draw Again" : "Draw Winners"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
