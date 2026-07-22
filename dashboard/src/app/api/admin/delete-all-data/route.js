import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import Raid from "../../../../../lib/models/Raid";
import Tweet from "../../../../../lib/models/Tweet";
import User from "../../../../../lib/models/User";
import UserRoleExpiration from "../../../../../lib/models/UserRoleExpiration";
import { isAdmin, triggerBotSync } from "../../../../../lib/discord";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    
    // Secure verification: Must be admin
    if (!session || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized: Admins only" }, { status: 401 });
    }

    const { confirmation } = await req.json();
    if (confirmation !== "I want to Fuck Chess Dao Data Base") {
      return NextResponse.json({ error: "Invalid confirmation phrase" }, { status: 400 });
    }

    await dbConnect();

    // 1. Delete all raids
    const raidsDelete = await Raid.deleteMany({});
    
    // 2. Delete all tweets
    const tweetsDelete = await Tweet.deleteMany({});
    
    // 3. Reset points and stats for all users
    const usersReset = await User.updateMany(
      {},
      {
        $set: {
          points: 0,
          raidsSubmitted: 0,
          raidsApproved: 0
        }
      }
    );

    // 4. Delete all user role expirations
    const expirationsDelete = await UserRoleExpiration.deleteMany({});

    // Reset claimedSlots back to 0 for all marketplace items
    const marketReset = await MarketItem.updateMany({}, { $set: { claimedSlots: 0 } });

    // 5. Trigger bot sync
    try {
      await triggerBotSync({ action: "update_all" });
    } catch (botErr) {
      console.error("Error triggering bot sync after DB reset:", botErr);
      // Don't fail the request if bot sync fails (e.g. if bot is offline)
    }

    return NextResponse.json({
      success: true,
      message: "All database raid points and target data have been successfully deleted/reset.",
      details: {
        deletedRaids: raidsDelete.deletedCount,
        deletedTweets: tweetsDelete.deletedCount,
        resetUsers: usersReset.modifiedCount,
        deletedExpirations: expirationsDelete.deletedCount,
        resetMarketplaceItems: marketReset.modifiedCount
      }
    });

  } catch (error) {
    console.error("Error during database reset API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
