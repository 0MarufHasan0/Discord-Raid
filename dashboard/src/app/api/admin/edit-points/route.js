import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../lib/models/User";
import { isAdmin, triggerBotSync } from "../../../../../lib/discord";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    
    // Secure verification: Must be admin
    if (!session || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized: Admins only" }, { status: 401 });
    }

    const { userId, amount, action } = await req.json();
    if (!userId || amount === undefined || !action) {
      return NextResponse.json({ error: "Missing required parameters (userId, amount, action)" }, { status: 400 });
    }

    const adjustAmount = Number(amount);
    if (isNaN(adjustAmount) || adjustAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    await dbConnect();

    // 1. Find user in database
    const user = await User.findOne({ discordId: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    // 2. Adjust points
    if (action === "add") {
      user.points += adjustAmount;
    } else if (action === "remove") {
      user.points = Math.max(0, user.points - adjustAmount);
    } else {
      return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
    }

    await user.save();

    // 3. Trigger live update
    await triggerBotSync({ action: "update_all" });

    // Send admin log
    try {
      await triggerBotSync({
        action: "log_action",
        details: {
          action: "Points Adjusted (Web)",
          executor: session.user.username,
          target: `${user.username} (${user.discordId})`,
          details: `Points manually **${action === 'add' ? 'added' : 'removed'}** via Web Dashboard.\n**Amount:** \`${adjustAmount}\` pts`,
          fields: [
            { name: 'New Balance', value: `${user.points} pts`, inline: true }
          ],
          color: action === 'add' ? 0x2ECC71 : 0xE74C3C
        }
      });
    } catch (logErr) {
      console.warn("Failed to trigger admin log for web points adjustment:", logErr);
    }

    return NextResponse.json({
      success: true,
      message: `Points successfully adjusted for ${user.username}`,
      newPoints: user.points
    });

  } catch (error) {
    console.error("Error editing member points:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
