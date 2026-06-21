"use client";

import { useState } from "react";
import { Coins, Tag, Clock, ArrowRight, CheckCircle, XCircle, ShieldCheck, Ticket, RefreshCw } from "lucide-react";

export default function ShopClient({ initialItems, initialPoints }) {
  const [items, setItems] = useState(initialItems);
  const [userPoints, setUserPoints] = useState(initialPoints);
  const [selectedItem, setSelectedItem] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", type: "", ticketChannel: "" });

  const handleOpenClaimConfirm = (item) => {
    setFeedback({ text: "", type: "", ticketChannel: "" });
    setSelectedItem(item);
  };

  const handleCloseClaimConfirm = () => {
    if (!claiming) {
      setSelectedItem(null);
    }
  };

  const handleClaimItem = async () => {
    if (!selectedItem) return;
    setClaiming(true);
    setFeedback({ text: "", type: "", ticketChannel: "" });

    try {
      const res = await fetch("/api/shop/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem._id }),
      });

      const data = await res.json();
      if (res.ok) {
        setUserPoints(data.remainingPoints);
        
        // Update items array claimed count locally
        setItems((prev) =>
          prev.map((i) =>
            i._id === selectedItem._id ? { ...i, claimedSlots: i.claimedSlots + 1 } : i
          )
        );

        setFeedback({
          text: data.message || `Successfully claimed ${selectedItem.name}!`,
          type: "success",
          ticketChannel: data.ticketChannelId || "",
        });
      } else {
        setFeedback({
          text: data.error || "Failed to claim item. Please try again.",
          type: "error",
          ticketChannel: "",
        });
      }
    } catch (err) {
      console.error(err);
      setFeedback({
        text: "An error occurred during verification. Please try again.",
        type: "error",
        ticketChannel: "",
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Grid listing of Shop Items */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const isSoldOut = item.claimedSlots >= item.totalSlots;
            const hasEnoughPoints = userPoints >= item.pointCost;
            const claimedPercent = Math.min(100, Math.round((item.claimedSlots / item.totalSlots) * 100));

            return (
              <div
                key={item._id}
                className="glass-panel p-6 rounded-2xl flex flex-col justify-between border border-indigo-950/20 relative group overflow-hidden shimmer-hover"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="space-y-4">
                  {/* Item Header */}
                  <div className="flex items-start justify-between">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                      item.roleId 
                        ? "bg-purple-950/30 border border-purple-500/20 text-purple-400" 
                        : "bg-cyan-950/30 border border-cyan-500/20 text-cyan-400"
                    }`}>
                      {item.roleId ? <ShieldCheck className="w-3.5 h-3.5 mr-0.5" /> : <Tag className="w-3.5 h-3.5 mr-0.5" />}
                      <span>{item.roleId ? "Discord Role" : "Whitelist Slot"}</span>
                    </span>

                    <span className="flex items-center space-x-1 text-amber-400 font-extrabold text-xs tracking-wider text-glow-amber">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>{item.pointCost.toLocaleString()} PTS</span>
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold font-outfit text-white leading-snug">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed line-clamp-3">
                      {item.description}
                    </p>
                  </div>

                  {/* Progress Slots Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>Redeemed</span>
                      <span>{item.claimedSlots} / {item.totalSlots} ({claimedPercent}%)</span>
                    </div>
                    <div className="w-full bg-[#030307] h-2 rounded-full overflow-hidden border border-indigo-950/30">
                      <div
                        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${claimedPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Item Expiry if set */}
                  {item.expiresAt && (
                    <div className="flex items-center space-x-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Ends: {new Date(item.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-indigo-950/20">
                  <button
                    onClick={() => handleOpenClaimConfirm(item)}
                    disabled={isSoldOut}
                    className={`w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 cursor-pointer ${
                      isSoldOut
                        ? "bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                        : hasEnoughPoints
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white shadow-lg shadow-indigo-500/10"
                        : "border border-rose-500/25 bg-rose-950/10 text-rose-400 hover:bg-rose-950/20"
                    }`}
                  >
                    <span>{isSoldOut ? "Sold Out" : hasEnoughPoints ? "Redeem Item" : "Insufficient Points"}</span>
                    {!isSoldOut && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel p-16 rounded-2xl text-center border border-indigo-950/20">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-300">Shop is Empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
            There are currently no active items or whitelists in the shop. Keep check back soon!
          </p>
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in transition-all">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-indigo-500/20 shadow-2xl relative animate-fade-in-up">
            <h3 className="text-lg font-extrabold font-outfit text-white mb-2">
              Confirm Redemption
            </h3>
            
            {!feedback.text ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed mb-6 font-medium">
                  Are you sure you want to claim <strong className="text-slate-200">{selectedItem.name}</strong>? 
                  This will deduct <strong className="text-amber-400">{selectedItem.pointCost} points</strong> from your balance.
                </p>

                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={handleCloseClaimConfirm}
                    disabled={claiming}
                    className="px-5 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 hover:text-slate-200 bg-white/5 border border-white/5 rounded-full transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClaimItem}
                    disabled={claiming}
                    className="px-5 py-2 text-[10px] font-extrabold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {claiming && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>{claiming ? "Redeeming..." : "Confirm"}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 pt-2">
                  {feedback.type === "success" ? (
                    <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className={`text-sm font-bold ${feedback.type === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                      {feedback.type === "success" ? "Redemption Successful!" : "Redemption Failed"}
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-semibold">
                      {feedback.text}
                    </p>
                  </div>
                </div>

                {feedback.ticketChannel && (
                  <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 flex items-start space-x-3">
                    <Ticket className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <p className="font-extrabold text-cyan-400 uppercase tracking-wider">Discord Ticket Created</p>
                      <p className="text-slate-400 mt-0.5">
                        A private claim ticket channel has been created for you in the server. Please head to Discord to submit any whitelisting proof needed.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      setFeedback({ text: "", type: "", ticketChannel: "" });
                    }}
                    className="px-5 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-300 hover:text-white bg-indigo-950/30 border border-indigo-500/20 rounded-full transition-colors cursor-pointer"
                  >
                    Dismiss
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
