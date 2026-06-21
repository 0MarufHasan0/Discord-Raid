import Header from "./components/Header";
import dbConnect from "../../lib/db";
import Tweet from "../../lib/models/Tweet";
import User from "../../lib/models/User";
import Raid from "../../lib/models/Raid";
import MarketItem from "../../lib/models/MarketItem";
import { ArrowUpRight, Flame, Users, Coins, HelpCircle, Trophy, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { FadeInUp, ScaleIn, StaggerContainer, StaggerItem } from "./components/Motion";

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

      // 2. Filter image URL (if it's a tweet link, set to null)
      const url = tweetObj.imageUrl || '';
      let isRealImage = false;
      if (url.startsWith('http')) {
        const lowerUrl = url.toLowerCase();
        const isTweetLink = lowerUrl.includes('/status/') || 
                            lowerUrl.includes('/statuses/') || 
                            lowerUrl.includes('/i/status/');
        
        if (!isTweetLink) {
          try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            const isTwitterHost = hostname === 'x.com' || 
                                  hostname === 'www.x.com' || 
                                  hostname === 'twitter.com' || 
                                  hostname === 'www.twitter.com';
            isRealImage = !isTwitterHost;
          } catch (e) {
            isRealImage = false;
          }
        }
      }
      tweetObj.imageUrl = isRealImage ? url : null;

      return tweetObj;
    });

    // Fetch top 5 raiders
    const topUsers = await User.find()
      .sort({ points: -1, raidsApproved: -1 })
      .limit(5) || [];

    return {
      stats: { totalUsers, totalPoints, totalRaids, totalMarketItems },
      tweets: JSON.parse(JSON.stringify(processedTweets)),
      topUsers: JSON.parse(JSON.stringify(topUsers))
    };
  } catch (error) {
    console.error("Error fetching stats and tweets:", error);
    return {
      stats: { totalUsers: 0, totalPoints: 0, totalRaids: 0, totalMarketItems: 0 },
      tweets: [],
      topUsers: []
    };
  }
}

export default async function Home() {
  const { stats, tweets, topUsers } = await getStatsAndTweets();

  return (
    <>
      <Header />
      
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero Section */}
        <section className="text-center py-16 md:py-24 relative overflow-hidden">
          <FadeInUp delay={0.1}>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/30 border border-indigo-500/20 mb-6 pulse-glow-border">
              <Flame className="w-3.5 h-3.5" />
              <span>Chess DAO Whitelist & Raid Engine</span>
            </span>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 font-outfit">
              Dominate the Raids, <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent text-glow animate-text-gradient">
                Claim Premium Rewards
              </span>
            </h1>
          </FadeInUp>
          
          <FadeInUp delay={0.3}>
            <p className="max-w-2xl mx-auto text-slate-400 text-sm md:text-base mb-10 leading-relaxed font-sans font-medium">
              Connect your Discord account to submit raids, earn multipliers, track your leaderboard position, and redeem points for exclusive whitelists in the community shop.
            </p>
          </FadeInUp>

          <FadeInUp delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/leaderboard"
                className="w-full sm:w-auto px-8 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 text-xs font-bold text-white shadow-lg shadow-indigo-500/10 transition-all duration-300 flex items-center justify-center space-x-2 cursor-pointer shimmer-hover"
              >
                <span>View Leaderboard</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              
              <Link
                href="/shop"
                className="w-full sm:w-auto px-8 py-3 rounded-full border border-indigo-500/20 bg-indigo-950/15 hover:bg-indigo-950/25 text-xs font-bold text-indigo-300 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Browse Marketplace</span>
              </Link>
            </div>
          </FadeInUp>
        </section>

        {/* Stats Grid */}
        <StaggerContainer delay={0.5} className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16">
          <StaggerItem>
            <div className="glass-panel glow-card-indigo p-6 rounded-2xl relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Active Members</span>
                <Users className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <p className="text-2xl md:text-3xl font-extrabold font-outfit text-white tracking-wide">{stats.totalUsers.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Verified Discord Raiders</p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="glass-panel glow-card-amber p-6 rounded-2xl relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Total Points</span>
                <Coins className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <p className="text-2xl md:text-3xl font-extrabold font-outfit text-white tracking-wide text-glow-amber">{stats.totalPoints.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Raid points circulating</p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="glass-panel glow-card-rose p-6 rounded-2xl relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Approved Raids</span>
                <Flame className="w-5 h-5 text-rose-500 group-hover:animate-pulse" />
              </div>
              <p className="text-2xl md:text-3xl font-extrabold font-outfit text-white tracking-wide">{stats.totalRaids.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Valid submissions</p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="glass-panel glow-card-cyan p-6 rounded-2xl relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Shop Items</span>
                <ShoppingBag className="w-5 h-5 text-cyan-400 group-hover:translate-y-[-2px] transition-transform duration-300" />
              </div>
              <p className="text-2xl md:text-3xl font-extrabold font-outfit text-white tracking-wide text-glow-cyan">{stats.totalMarketItems}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-1">Active whitelist slots</p>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Content Section: Active Raids */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Tweets (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <FadeInUp delay={0.6}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-extrabold font-outfit text-slate-100 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Live Raids</span>
                </h2>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/20 border border-cyan-900/40 px-3 py-1 rounded-full font-bold">
                  {tweets.length} Active Targets
                </span>
              </div>
            </FadeInUp>

            {tweets.length > 0 ? (
              <StaggerContainer delay={0.7} className="space-y-4">
                {tweets.map((tweet) => {
                  const xLink = tweet.tweetId 
                    ? `https://x.com/i/status/${tweet.tweetId}` 
                    : `https://x.com/${tweet.postedBy}`;
                  return (
                    <StaggerItem key={tweet._id}>
                      <div className="glass-panel p-5 rounded-2xl border border-indigo-950/25 relative group overflow-hidden shimmer-hover">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="space-y-2 flex-grow">
                            <div className="flex items-center space-x-2">
                              <span className="text-[11px] font-bold text-indigo-400">@{tweet.postedBy}</span>
                              <span className="text-[10px] text-slate-500">•</span>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {new Date(tweet.postedAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                              </span>
                            </div>
                            
                            <p className="text-sm text-slate-300 font-sans leading-relaxed font-medium">
                              {tweet.content}
                            </p>

                            {tweet.imageUrl && (
                              <div className="mt-3 overflow-hidden rounded-xl border border-indigo-950/40 max-h-48 max-w-md transition-all duration-300 group-hover:border-indigo-500/35">
                                <img src={tweet.imageUrl} alt="Tweet Asset" className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center self-stretch w-full sm:w-auto border-t sm:border-t-0 border-indigo-950/20 pt-4 sm:pt-0">
                            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-amber-950/25 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold whitespace-nowrap tracking-wider">
                              <Coins className="w-3.5 h-3.5 text-amber-400 mr-0.5 animate-pulse" />
                              <span>+{tweet.points ?? 1} PTS</span>
                            </span>
                            
                            <a
                              href={xLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0 sm:mt-4 text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 border border-cyan-500/20 bg-cyan-950/10 px-4 py-2 rounded-full hover:bg-cyan-950/30 cursor-pointer"
                            >
                              <span>Raid Target</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggerContainer>
            ) : (
              <ScaleIn delay={0.7}>
                <div className="glass-panel p-12 rounded-2xl text-center border border-indigo-950/20">
                  <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-base font-semibold text-slate-300">No Active Raids</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                    All tweets have been successfully raided. Wait for admins to post new raid targets!
                  </p>
                </div>
              </ScaleIn>
            )}
          </div>

          {/* Quick FAQ / Info (Right 1 col) */}
          <div className="space-y-6">
            {/* Top Raiders Mini-Leaderboard */}
            <FadeInUp delay={0.6}>
              <h2 className="text-xl md:text-2xl font-extrabold font-outfit text-slate-100 flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>Top Raiders</span>
              </h2>
            </FadeInUp>

            <FadeInUp delay={0.7}>
              <div className="glass-panel p-5 rounded-2xl border border-indigo-950/20 space-y-4">
                {topUsers.length > 0 ? (
                  <div className="space-y-2">
                    {topUsers.map((user, idx) => {
                      const rank = idx + 1;
                      let rankBadge = (
                        <span className="text-[10px] font-extrabold text-slate-500 w-5 text-center">#{rank}</span>
                      );
                      if (rank === 1) rankBadge = <span className="text-amber-400 font-extrabold w-5 text-center">🥇</span>;
                      if (rank === 2) rankBadge = <span className="text-slate-300 font-extrabold w-5 text-center">🥈</span>;
                      if (rank === 3) rankBadge = <span className="text-amber-700 font-extrabold w-5 text-center">🥉</span>;

                      const firstLetter = (user.username || 'U').charAt(0).toUpperCase();
                      return (
                        <div key={user._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-indigo-950/15 border border-transparent hover:border-indigo-950/10 transition-all duration-300">
                          <div className="flex items-center space-x-2.5">
                            {rankBadge}
                            <div className="w-7 h-7 rounded-full bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                              {firstLetter}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-200">{user.username}</span>
                              <span className="text-[9px] text-slate-500 font-semibold">{user.raidsApproved ?? 0} approved</span>
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-amber-400 text-glow-amber">
                            {user.points.toLocaleString()} PTS
                          </span>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-indigo-950/25">
                      <Link
                        href="/leaderboard"
                        className="w-full py-2 rounded-xl border border-indigo-500/20 bg-indigo-950/15 hover:bg-indigo-950/30 text-[10px] font-bold text-indigo-300 hover:text-indigo-200 transition-all flex items-center justify-center space-x-1.5 uppercase tracking-wider cursor-pointer"
                      >
                        <span>View Full Leaderboard</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No raiders ranked yet.</p>
                )}
              </div>
            </FadeInUp>
            <FadeInUp delay={0.6}>
              <h2 className="text-xl md:text-2xl font-extrabold font-outfit text-slate-100 flex items-center space-x-2">
                <span>How it Works</span>
              </h2>
            </FadeInUp>

            <FadeInUp delay={0.7}>
              <div className="glass-panel p-6 rounded-2xl border border-indigo-950/20 space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Join the Raid</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Click the "Raid Target" link to perform the Twitter actions (like, retweet, or comment).
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Submit Proof</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Complete verification on Twitter or use the bot commands `/submitraid` to submit proof.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Accumulate Points</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Once approved by admins, points are deposited into your profile dashboard immediately.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 mt-0.5 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                    4
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Shop Marketplace</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Redeem your points directly in the web Shop to claim roles or whitelist items instantly.
                    </p>
                  </div>
                </div>
              </div>
            </FadeInUp>
          </div>
        </section>
      </main>

      <footer className="border-t border-indigo-950/30 bg-[#020204] py-8 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} Chess DAO. All rights reserved. Built for competitive raiding.</p>
      </footer>
    </>
  );
}
