import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../lib/models/User";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { twitter } = await req.json();
    
    // Clean and validate twitter username
    let cleanTwitter = twitter ? twitter.trim().replace(/^@/, "").toLowerCase() : null;
    if (cleanTwitter && !/^[a-zA-Z0-9_]{1,15}$/.test(cleanTwitter)) {
      return NextResponse.json({ error: "Invalid Twitter handle format" }, { status: 400 });
    }

    await dbConnect();

    if (cleanTwitter) {
      const existingUser = await User.findOne({
        twitter: cleanTwitter,
        discordId: { $ne: session.user.id }
      });
      if (existingUser) {
        return NextResponse.json({ error: "This Twitter handle is already linked to another user" }, { status: 400 });
      }
    }
    
    // Find and update user in database
    const updatedUser = await User.findOneAndUpdate(
      { discordId: session.user.id },
      { twitter: cleanTwitter },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, twitter: updatedUser.twitter });
  } catch (error) {
    console.error("Error updating Twitter username:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
