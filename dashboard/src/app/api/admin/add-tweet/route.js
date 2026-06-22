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

    const { tweetId, content, imageUrl, points, postedBy } = await req.json();
    if (!tweetId || !content) {
      return NextResponse.json({ error: "Missing required fields (tweetId, content)" }, { status: 400 });
    }

    await dbConnect();

    // 1. Check if tweet already exists
    const existing = await Tweet.findOne({ tweetId });
    if (existing) {
      return NextResponse.json({ error: "Target tweet already exists" }, { status: 400 });
    }

    // 2. Create the tweet
    const tweet = new Tweet({
      tweetId,
      content,
      imageUrl: imageUrl || null,
      postedBy: postedBy || "ChessDAO",
      points: Number(points) || 1,
      postedAt: new Date(),
      channelId: process.env.TWEET_CHANNEL_ID || "1396070952760119327",
    });

    await tweet.save();

    // 3. Trigger bot sync
    await triggerBotSync({ action: "update_all" });



    return NextResponse.json({
      success: true,
      message: "Target tweet added successfully",
      tweet
    });

  } catch (error) {
    console.error("Error adding target tweet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
