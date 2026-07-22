import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "../../../../../lib/db";
import MarketItem from "../../../../../lib/models/MarketItem";
import User from "../../../../../lib/models/User";
import UserRoleExpiration from "../../../../../lib/models/UserRoleExpiration";
import { triggerBotSync, getGuildMember, getGuildRoles } from "../../../../../lib/discord";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await req.json();
    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    await dbConnect();

    // 1. Find the item
    const item = await MarketItem.findOne({ _id: itemId, isActive: true });
    if (!item) {
      return NextResponse.json({ error: "Marketplace item not found or inactive" }, { status: 404 });
    }

    // 2. Check expiry
    if (item.expiresAt && new Date() > item.expiresAt) {
      return NextResponse.json({ error: "This item has expired" }, { status: 400 });
    }

    // 3. Check slot availability
    if (item.claimedSlots >= item.totalSlots) {
      return NextResponse.json({ error: "All available slots have been claimed" }, { status: 400 });
    }

    // 4. Find user
    const user = await User.findOne({ discordId: session.user.id });
    if (!user) {
      return NextResponse.json({ error: "User profile not found in database" }, { status: 400 });
    }

    // 5. Verify point balance
    if (user.points < item.pointCost) {
      return NextResponse.json({ error: `Insufficient points. Required: ${item.pointCost} | You have: ${user.points}` }, { status: 400 });
    }

    // 5.5 Validate role claim: existence, hierarchy, and ownership
    if (item.roleId) {
      const [member, roles] = await Promise.all([
        getGuildMember(user.discordId),
        getGuildRoles()
      ]);

      if (roles && roles.length > 0) {
        const targetRole = roles.find(r => r.id === item.roleId);
        if (!targetRole) {
          return NextResponse.json({ error: "The configured role for this item does not exist in the Discord server." }, { status: 400 });
        }

        // Check hierarchy
        const botMember = await getGuildMember(process.env.DISCORD_CLIENT_ID || "");
        if (botMember && botMember.roles) {
          const botRoles = roles.filter(r => botMember.roles.includes(r.id));
          const botHighestPosition = botRoles.reduce((max, r) => Math.max(max, r.position), 0);
          if (targetRole.position >= botHighestPosition) {
            return NextResponse.json({ error: "The bot cannot assign this role because it is higher than the bot's highest role. Please contact an admin." }, { status: 400 });
          }
        }
      }

      if (member && member.roles && member.roles.includes(item.roleId)) {
        return NextResponse.json({ error: `You already have the ${item.name} role! You cannot claim it again.` }, { status: 400 });
      }
    }

    // 6. Atomically claim slot to prevent race conditions
    const updatedItem = await MarketItem.findOneAndUpdate(
      { _id: itemId, claimedSlots: { $lt: item.totalSlots } },
      { $inc: { claimedSlots: 1 } },
      { new: true }
    );

    if (!updatedItem) {
      return NextResponse.json({ error: "All slots were claimed just now" }, { status: 400 });
    }

    // 7. Deduct points from user
    user.points -= item.pointCost;
    await user.save();

    let botResponse = null;

    // 8. Trigger Discord bot sync actions
    if (item.roleId) {
      // Role claim
      const now = new Date();
      const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

      
      await UserRoleExpiration.findOneAndUpdate(
        { userId: user.discordId, guildId: process.env.DISCORD_GUILD_ID, roleId: item.roleId },
        { itemName: item.name, expiresAt: expiresAt, createdAt: new Date() },
        { upsert: true, new: true }
      );

      // Trigger bot to assign role in guild
      botResponse = await triggerBotSync({
        action: "add_role",
        userId: user.discordId,
        roleId: item.roleId,
        itemName: item.name
      });
    } else {
      // Whitelist claim: trigger bot to create ticket
      botResponse = await triggerBotSync({
        action: "create_ticket",
        userId: user.discordId,
        username: user.username,
        itemName: item.name
      });
    }

    // Trigger updates to live marketplace/leaderboard messages
    await triggerBotSync({ action: "update_all" });

    return NextResponse.json({
      success: true,
      message: item.roleId
        ? `Successfully claimed the role: ${item.name}! Check your Discord roles.`
        : `Successfully claimed ${item.name}! A claims ticket has been created on Discord.`,
      remainingPoints: user.points,
      ticketChannelId: botResponse?.channelId || null
    });

  } catch (error) {
    console.error("Error claiming shop item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
