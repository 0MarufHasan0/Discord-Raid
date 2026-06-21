import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import Raid from "../../../../../lib/models/Raid";
import User from "../../../../../lib/models/User";
import { isAdmin, triggerBotSync } from "../../../../../lib/discord";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    
    // Secure verification: Must be admin
    if (!session || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized: Admins only" }, { status: 401 });
    }

    const { raidId, reason } = await req.json();
    if (!raidId) {
      return NextResponse.json({ error: "Missing raidId" }, { status: 400 });
    }

    await dbConnect();

    // 1. Find the raid submission
    const raid = await Raid.findOne({ raidId });
    if (!raid) {
      return NextResponse.json({ error: "Raid submission not found" }, { status: 404 });
    }

    if (raid.status !== "pending") {
      return NextResponse.json({ error: `Raid is already ${raid.status}` }, { status: 400 });
    }

    // 2. Adjust submitted counter for User
    let user = await User.findOne({ discordId: raid.userId });
    if (user) {
      user.raidsSubmitted = Math.max(0, (user.raidsSubmitted ?? 0) + 1);
      await user.save();
    }

    // 3. Update Raid status to rejected
    raid.status = "rejected";
    raid.approvedAt = new Date();
    raid.approvedBy = session.user.username;
    raid.rejectedReason = reason || "Does not meet requirements";
    await raid.save();

    // 4. Trigger bot update
    await triggerBotSync({ action: "update_all" });

    return NextResponse.json({
      success: true,
      message: "Raid submission rejected"
    });

  } catch (error) {
    console.error("Error rejecting raid:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
