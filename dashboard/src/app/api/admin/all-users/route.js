import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../lib/models/User";
import Raid from "../../../../../lib/models/Raid";
import { isAdmin } from "../../../../../lib/discord";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    
    // Secure verification: Must be admin
    if (!session || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized: Admins only" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tweetId = searchParams.get("tweetId")?.trim();

    await dbConnect();

    let users = [];

    if (tweetId) {
      // Find all approved raids for the specific tweetId
      const raids = await Raid.find({ tweetId, status: "approved" });
      const discordIds = raids.map((r) => r.userId);
      
      // Find matching users
      users = await User.find(
        { discordId: { $in: discordIds } },
        "discordId username twitter points raidsApproved raidsSubmitted"
      ).sort({ points: -1 }) || [];
    } else {
      // Fetch all users selecting only required fields
      users = await User.find(
        {},
        "discordId username twitter points raidsApproved raidsSubmitted"
      ).sort({ points: -1 }) || [];
    }

    return NextResponse.json({
      success: true,
      users
    });

  } catch (error) {
    console.error("Error fetching all users for admin:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
