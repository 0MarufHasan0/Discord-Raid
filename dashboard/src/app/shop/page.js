import Header from "../components/Header";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "../../../lib/db";
import MarketItem from "../../../lib/models/MarketItem";
import User from "../../../lib/models/User";
import ShopClient from "./ShopClient";

export const revalidate = 0; // Fresh content on load

async function getShopData(userId) {
  try {
    await dbConnect();
    
    // Fetch active market items that haven't expired
    const now = new Date();
    const items = await MarketItem.find({
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    }).sort({ createdAt: 1 }) || [];

    // Fetch user's current points
    const user = await User.findOne({ discordId: userId }) || null;

    return {
      items: JSON.parse(JSON.stringify(items)),
      userPoints: user ? user.points : 0
    };
  } catch (error) {
    console.error("Error fetching shop data:", error);
    return { items: [], userPoints: 0 };
  }
}

export default async function ShopPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }

  const { items, userPoints } = await getShopData(session.user.id);

  return (
    <>
      <Header />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center md:text-left mb-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold font-outfit text-white mb-2">
              Marketplace
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-xl">
              Redeem your hard-earned raid points for discord roles, server whitelist items, and other rewards.
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/25 px-5 py-2.5 rounded-2xl flex items-center space-x-2">
            <span className="text-amber-400 font-bold text-lg font-outfit">{userPoints.toLocaleString()} pts</span>
          </div>
        </div>

        <ShopClient initialItems={items} initialPoints={userPoints} />
      </main>
    </>
  );
}
