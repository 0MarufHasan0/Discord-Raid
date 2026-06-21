import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import Tweet from "../../../../../lib/models/Tweet";
import { isAdmin, triggerBotSync } from "../../../../../lib/discord";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    
    // Secure verification: Must be admin
    if (!session || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized: Admins only" }, { status: 401 });
    }

    const { tweetId } = await req.json();
    if (!tweetId) {
      return NextResponse.json({ error: "Missing tweetId" }, { status: 400 });
    }

    await dbConnect();

    // 1. Delete the tweet
    const result = await Tweet.deleteOne({ tweetId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Target tweet not found" }, { status: 404 });
    }

    // 2. Trigger bot sync
    await triggerBotSync({ action: "update_all" });

    // Send admin log
    try {
      await triggerBotSync({
        action: "log_action",
        details: {
          action: "Tweet Deleted (Web)",
          executor: session.user.username,
          target: `Tweet ID: ${tweetId}`,
          details: `Deleted target tweet **${tweetId}** from the dashboard.`,
          color: 0xE74C3C // Red
        }
      });
    } catch (logErr) {
      console.warn("Failed to trigger admin log for web tweet deletion:", logErr);
    }

    return NextResponse.json({
      success: true,
      message: "Target tweet deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting target tweet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
