import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import User from "../../../../../lib/models/User";
import { isAdmin } from "../../../../../lib/discord";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    
    // Secure verification: Must be admin
    if (!session || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized: Admins only" }, { status: 401 });
    }

    await dbConnect();

    // Fetch all users selecting only required fields
    const users = await User.find(
      {},
      "discordId username twitter points raidsApproved raidsSubmitted"
    ).sort({ points: -1 }) || [];

    return NextResponse.json({
      success: true,
      users
    });

  } catch (error) {
    console.error("Error fetching all users for admin:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
