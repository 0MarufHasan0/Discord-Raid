import Header from "./components/Header";
import dbConnect from "../../lib/db";
import Tweet from "../../lib/models/Tweet";
import User from "../../lib/models/User";
import Raid from "../../lib/models/Raid";
import MarketItem from "../../lib/models/MarketItem";
import { ArrowUpRight, Flame, Users, Coins, HelpCircle } from "lucide-react";
import Link from "next/link";

// Force dynamic so data is always fresh on page load
export const revalidate = 0;

async function getStatsAndTweets() {
  try {
    await dbConnect();
    
    // Fetch counts
    const totalUsers = await User.countDocuments() || 0;
    const totalRaids = await Raid.countDocuments({ status: "approved" }) || 0;
    const totalMarketItems = await MarketItem.countDocuments({ isActive: true }) || 0;
    
    // Sum points
    const pointsResult = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$points" } } }
    ]);
    const totalPoints = pointsResult[0]?.total || 0;

    // Fetch active tweets (not expired)
    const now = new Date();
    const activeTweets = await Tweet.find({
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    }).sort({ postedAt: -1 }).limit(10) || [];

    // Parse out any Discord user mentions (<@123456789>)
    const mentionIds = [];
    const mentionRegex = /<@!?(\d+)>/g;
    activeTweets.forEach(t => {
      let match;
      mentionRegex.lastIndex = 0;
      while ((match = mentionRegex.exec(t.content || '')) !== null) {
        mentionIds.push(match[1]);
      }
    });

    const mentionedUsers = {};
    if (mentionIds.length > 0) {
      const usersList = await User.find({ discordId: { $in: mentionIds } });
      usersList.forEach(u => {
        mentionedUsers[u.discordId] = u.username;
      });
    }

    const processedTweets = activeTweets.map(t => {
      const tweetObj = t.toObject ? t.toObject() : t;
      
      // 1. Resolve mentions dynamically
      if (tweetObj.content) {
        mentionRegex.lastIndex = 0;
        tweetObj.content = tweetObj.content.replace(mentionRegex, (match, id) => {
          return mentionedUsers[id] ? `@${mentionedUsers[id]}` : "@Member";
        });
      }

      // 2. Filter image URL (if it's a tweet link status status, set to null)
      const url = tweetObj.imageUrl || '';
      const isRealImage = url.startsWith('http') && 
                          !url.includes('twitter.com/status/') && 
                          !url.includes('x.com/status/') &&
                          !url.includes('twitter.com/i/status/') &&
                          !url.includes('x.com/i/status/');
      tweetObj.imageUrl = isRealImage ? url : null;

      return tweetObj;
    });

    return {
      stats: { totalUsers, totalPoints, totalRaids, totalMarketItems },
      tweets: JSON.parse(JSON.stringify(processedTweets))
    };
  } catch (error) {
    console.error("Error fetching stats and tweets:", error);
    return {
      stats: { totalUsers: 0, totalPoints: 0, totalRaids: 0, totalMarketItems: 0 },
      tweets: []
    };
  }
}


export default async function Home() {
  const { stats, tweets } = await getStatsAndTweets();

  return (
    <>
      <Header />
      
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <section className="text-center py-16 md:py-24 relative overflow-hidden">
          {/* Subtle decorative glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute top-10 left-10 w-[200px] h-[200px] bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none" />

          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/45 border border-indigo-900/50 mb-6 pulse-glow-border">
            <Flame className="w-3.5 h-3.5" />
            <span>Chess DAO Whitelist & Raid Engine</span>
          </span>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 font-outfit">
            Dominate the Raids, <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent text-glow">
              Claim Premium Rewards
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-base md:text-lg text-slate-400 mb-10 leading-relaxed font-sans">
            Connect your Discord account to submit raids, earn multipliers, track your leaderboard position, and redeem points for exclusive whitelists in the community shop.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/leaderboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <span>View Leaderboard</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            
            <Link
              href="/shop"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full border border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-950/30 text-sm font-semibold text-indigo-300 transition-all flex items-center justify-center space-x-2"
            >
              <span>Browse Marketplace</span>
            </Link>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Active Members</span>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold font-outfit text-white">{stats.totalUsers}</p>
            <p className="text-xs text-slate-500 mt-1">Verified Discord Raiders</p>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total Points Distributed</span>
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold font-outfit text-white">{stats.totalPoints.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Raid points circulating</p>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Rains & Raids Approved</span>
              <Flame className="w-5 h-5 text-rose-500" />
            </div>
            <p className="text-2xl md:text-3xl font-bold font-outfit text-white">{stats.totalRaids.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Valid submissions</p>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Available Shop Items</span>
              <Coins className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold font-outfit text-white">{stats.totalMarketItems}</p>
            <p className="text-xs text-slate-500 mt-1">Active whitelist slots</p>
          </div>
        </section>

        {/* Content Section: Active Raids */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Tweets (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold font-outfit text-slate-100 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 pulse-glow-border" />
                <span>Live Raids</span>
              </h2>
              <span className="text-xs text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 px-2.5 py-0.5 rounded-full font-medium">
                {tweets.length} Active Targets
              </span>
            </div>

            {tweets.length > 0 ? (
              <div className="space-y-4">
                {tweets.map((tweet) => {
                  const xLink = tweet.tweetId 
                    ? `https://x.com/i/status/${tweet.tweetId}` 
                    : `https://x.com/${tweet.postedBy}`;
                  return (
                    <div key={tweet._id} className="glass-panel p-5 rounded-xl border border-indigo-950/20 relative group overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-indigo-400">@{tweet.postedBy}</span>
                            <span className="text-[10px] text-slate-500">•</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(tweet.postedAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                            </span>
                          </div>
                          
                          <p className="text-sm text-slate-300 font-sans line-clamp-3 leading-relaxed">
                            {tweet.content}
                          </p>

                          {tweet.imageUrl && (
                            <div className="mt-3 overflow-hidden rounded-lg border border-indigo-950/50 max-h-48 max-w-md">
                              <img src={tweet.imageUrl} alt="Tweet Asset" className="w-full h-auto object-cover" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end justify-between self-stretch">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-950/35 border border-amber-500/20 text-amber-400 text-xs font-bold whitespace-nowrap">
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>+{tweet.points ?? 1} pts</span>
                          </span>
                          
                          <a
                            href={xLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-0.5 border border-cyan-500/20 bg-cyan-950/10 px-3 py-1.5 rounded-full hover:bg-cyan-950/30"
                          >
                            <span>Raid Now</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-panel p-12 rounded-2xl text-center border border-indigo-950/20">
                <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-base font-semibold text-slate-300">No Active Raids</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                  All tweets have been successfully raided. Wait for admins to post new raid objectives!
                </p>
              </div>
            )}
          </div>

          {/* Quick FAQ / Info (Right 1 col) */}
          <div className="space-y-6">
            <h2 className="text-xl md:text-2xl font-bold font-outfit text-slate-100 flex items-center space-x-2">
              <span>How it Works</span>
            </h2>

            <div className="glass-panel p-6 rounded-2xl border border-indigo-950/20 space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Join the Raid</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Click the "Raid Now" link to perform the Twitter raid (like, comment, retweet, bookmark).
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Submit Proof</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Use the Discord bot commands `/submitraid` or complete Twitter verification to record your raid.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Accumulate Points</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Once approved by admins, points are deposited into your profile. Build a streak for multipliers!
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5">
                  4
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Shop Marketplace</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Redeem your points directly in the web Shop to claim roles or whitelist items instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-indigo-950/30 bg-[#040409] py-8 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} Chess DAO. All rights reserved. Built for competitive raiding.</p>
      </footer>
    </>
  );
}
