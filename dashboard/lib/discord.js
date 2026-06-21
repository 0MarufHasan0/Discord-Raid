export async function getGuildMember(userId) {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error fetching guild member:', error);
    return null;
  }
}

export async function isAdmin(userId) {
  if (!userId) return false;
  const member = await getGuildMember(userId);
  if (!member) return false;
  
  const adminRoles = (process.env.ADMIN_ROLE_ID || '').split(',').map(id => id.trim()).filter(Boolean);
  return member.roles.some(roleId => adminRoles.includes(roleId));
}

/**
 * Triggers a synchronization event in the active Discord Bot process.
 * If the bot process is offline/sleeping, it logs a warning but allows the dashboard to succeed.
 */
export async function triggerBotSync(payload) {
  try {
    const botUrl = process.env.BOT_API_URL || 'http://localhost:3005';
    const res = await fetch(`${botUrl}/api/bot/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXTAUTH_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[BotSync] Webhook failed with status ${res.status}`);
      return false;
    }
    return await res.json();
  } catch (error) {
    console.warn(`[BotSync] Failed to sync with Discord Bot API at ${process.env.BOT_API_URL}:`, error.message);
    return false;
  }
}

export async function getGuildRoles() {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/roles`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Error fetching guild roles:', error);
    return [];
  }
}

