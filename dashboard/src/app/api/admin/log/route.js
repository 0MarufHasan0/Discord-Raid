import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { isAdmin, triggerBotSync } from "../../../../../lib/discord";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    
    // Secure verification: Must be admin
    if (!session || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized: Admins only" }, { status: 401 });
    }

    const { action, target, details, fields, color } = await req.json();

    if (!action) {
      return NextResponse.json({ error: "Missing action field" }, { status: 400 });
    }

    // Trigger bot sync to log the action
    await triggerBotSync({
      action: "log_action",
      details: {
        action,
        executor: session.user.username,
        target: target || "N/A",
        details: details || "",
        fields: fields || [],
        color: color || 0x5865F2
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error in Next.js admin log API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
