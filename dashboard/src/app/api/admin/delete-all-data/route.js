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

    // 5. Trigger bot sync
    try {
      await triggerBotSync({ action: "update_all" });

      // Send admin log
      await triggerBotSync({
        action: "log_action",
        details: {
          action: "Database Wipe (Web)",
          executor: session.user.username,
          target: "Entire Database",
          details: `Reset/cleared all database collections via Web Dashboard.`,
          fields: [
            { name: 'Deleted Raids', value: `${raidsDelete.deletedCount}`, inline: true },
            { name: 'Deleted Tweets', value: `${tweetsDelete.deletedCount}`, inline: true },
            { name: 'Reset Users', value: `${usersReset.modifiedCount}`, inline: true },
            { name: 'Deleted Expirations', value: `${expirationsDelete.deletedCount}`, inline: true }
          ],
          color: 0xE74C3C // Red
        }
      });
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
        deletedExpirations: expirationsDelete.deletedCount
      }
    });

  } catch (error) {
    console.error("Error during database reset API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
