const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const checkAdmin = require('../../utils/checkAdmin');
const MarketItem = require('../../database/models/MarketItem');
const updateMarketplace = require('../../utils/updateMarketplace');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addwlitem')
    .setDescription('Add a new item to the marketplace')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the item/whitelist role')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Brief description of the item')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('point_cost')
        .setDescription('Points cost to claim this item')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('total_slots')
        .setDescription('Total number of slots available')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to automatically give to members who buy this item (optional)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('create_role_name')
        .setDescription('Name of a new role to create on the server (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('claim_duration_days')
        .setDescription('Number of days the role remains active for the member (default: 30)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_days')
        .setDescription('Number of days this item remains active in market (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_hours')
        .setDescription('Number of hours this item remains active in market (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration_minutes')
        .setDescription('Number of minutes this item remains active in market (optional)')
        .setRequired(false)),
  async execute(interaction) {
    try {
      // Check admin permissions
      const isAdmin = await checkAdmin(interaction);
      if (!isAdmin) return;

      const name = interaction.options.getString('name').trim();
      const description = interaction.options.getString('description').trim();
      const pointCost = interaction.options.getInteger('point_cost');
      const totalSlots = interaction.options.getInteger('total_slots');

      const role = interaction.options.getRole('role');
      const createRoleName = interaction.options.getString('create_role_name');
      const claimDurationDaysOption = interaction.options.getInteger('claim_duration_days');
      const claimDurationDays = claimDurationDaysOption !== null ? claimDurationDaysOption : 30;

      const durationDays = interaction.options.getInteger('duration_days') || 0;
      const durationHours = interaction.options.getInteger('duration_hours') || 0;
      const durationMinutes = interaction.options.getInteger('duration_minutes') || 0;

      if (pointCost <= 0 || totalSlots <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Cost এবং Slots অবশ্যই ০-এর চেয়ে বেশি হতে হবে।")],
          ephemeral: true
        });
      }

      if (claimDurationDays <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Claim Duration অবশ্যই ০-এর চেয়ে বেশি হতে হবে।")],
          ephemeral: true
        });
      }

      let roleId = role ? role.id : null;

      // Auto-create role if name is specified and role isn't selected
      if (!roleId && createRoleName) {
        let existingRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === createRoleName.trim().toLowerCase());
        if (!existingRole) {
          try {
            existingRole = await interaction.guild.roles.create({
              name: createRoleName.trim(),
              reason: `Auto-created for marketplace item: ${name}`
            });
            console.log(`[Auto Role Create] Created role '${existingRole.name}' with ID ${existingRole.id}`);
          } catch (createErr) {
            console.error(`❌ Failed to create role '${createRoleName}':`, createErr);
            return interaction.reply({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${createRoleName}' রোলটি তৈরি করতে ব্যর্থ হয়েছে। বটের Role Manage করার পারমিশন চেক করুন।`)],
              ephemeral: true
            });
          }
        }
        roleId = existingRole.id;
      }

      let expiresAt = null;
      const durationMs = (durationDays * 24 * 60 * 60 * 1000) +
                       (durationHours * 60 * 60 * 1000) +
                       (durationMinutes * 60 * 1000);

      if (durationMs > 0) {
        expiresAt = new Date(Date.now() + durationMs);
      }

      // Check if item already exists (case-insensitive)
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingItem = await MarketItem.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
      if (existingItem) {
        // If it exists but is inactive, we can reactivate and update it
        if (!existingItem.isActive) {
          existingItem.description = description;
          existingItem.pointCost = pointCost;
          existingItem.totalSlots = totalSlots;
          existingItem.claimedSlots = 0; 
          existingItem.isActive = true;
          existingItem.expiresAt = expiresAt;
          existingItem.roleId = roleId;
          existingItem.claimDurationDays = claimDurationDays;
          await existingItem.save();

          // Update live marketplace channel
          updateMarketplace(interaction.client);

          let successDesc = `✅ Inactive Marketplace item '${name}' পুনরায় active করা হয়েছে!\n💰 Cost: **${pointCost}** points\n🎟️ Slots: **${totalSlots}**`;
          if (roleId) {
            successDesc += `\n🎭 **Role:** <@&${roleId}>`;
            successDesc += `\n⏳ **Duration:** **${claimDurationDays}** দিন`;
          }
          if (expiresAt) {
            const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);
            successDesc += `\n⏰ **Market Expiry:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
          }

          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(successDesc)],
            ephemeral: true
          });
        }

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ '${name}' নামে একটি active item ইতিমধ্যেই রয়েছে।`)],
          ephemeral: true
        });
      }

      // Create new MarketItem
      const newItem = new MarketItem({
        name,
        description,
        pointCost,
        totalSlots,
        claimedSlots: 0,
        isActive: true,
        expiresAt: expiresAt,
        roleId: roleId,
        claimDurationDays: claimDurationDays
      });
      await newItem.save();

      // Update live marketplace channel
      updateMarketplace(interaction.client);

      let replyDesc = `✅ Marketplace এ '**${name}**' add হয়েছে!\n💰 Cost: **${pointCost}** points\n🎟️ Slots: **${totalSlots}**`;
      if (roleId) {
        replyDesc += `\n🎭 **Role:** <@&${roleId}>`;
        replyDesc += `\n⏳ **Duration:** **${claimDurationDays}** দিন`;
      }
      if (expiresAt) {
        const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);
        replyDesc += `\n⏰ **Market Expiry:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
      }

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(replyDesc);

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

    } catch (error) {
      console.error('Error in /addwlitem command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        } else {
          await interaction.reply({ content: "❌ একটা error হয়েছে। আবার চেষ্টা করো।", ephemeral: true });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
