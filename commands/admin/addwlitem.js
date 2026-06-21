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
        .setDescription('Number of days the role remains active for the member (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('claim_duration_hours')
        .setDescription('Number of hours the role remains active for the member (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('claim_duration_minutes')
        .setDescription('Number of minutes the role remains active for the member (optional)')
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

      const claimDurationDays = interaction.options.getInteger('claim_duration_days') || 0;
      const claimDurationHours = interaction.options.getInteger('claim_duration_hours') || 0;
      const claimDurationMinutes = interaction.options.getInteger('claim_duration_minutes') || 0;

      let claimDurationMs = (claimDurationDays * 24 * 60 * 60 * 1000) +
                            (claimDurationHours * 60 * 60 * 1000) +
                            (claimDurationMinutes * 60 * 1000);

      // Default to 30 days if no validity options are provided
      if (interaction.options.getInteger('claim_duration_days') === null &&
          interaction.options.getInteger('claim_duration_hours') === null &&
          interaction.options.getInteger('claim_duration_minutes') === null) {
        claimDurationMs = 30 * 24 * 60 * 60 * 1000;
      }

      const durationDays = interaction.options.getInteger('duration_days') || 0;
      const durationHours = interaction.options.getInteger('duration_hours') || 0;
      const durationMinutes = interaction.options.getInteger('duration_minutes') || 0;

      if (pointCost <= 0 || totalSlots <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Point cost and slots must be greater than 0.")],
          flags: MessageFlags.Ephemeral
        });
      }

      if (claimDurationMs <= 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription("❌ Claim duration must be greater than 0.")],
          flags: MessageFlags.Ephemeral
        });
      }

      let roleId = role ? role.id : null;

      if (roleId) {
        // Check if this role is already linked to an active marketplace item
        const duplicateRoleItem = await MarketItem.findOne({ roleId: roleId, isActive: true });
        if (duplicateRoleItem) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ The role <@&${roleId}> is already in use by another active marketplace item ('${duplicateRoleItem.name}').`)],
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Auto-create role if name is specified and role isn't selected
      if (!roleId && createRoleName) {
        let existingRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === createRoleName.trim().toLowerCase());
        if (existingRole) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ A role named '${createRoleName}' already exists in this server. Please provide another name or delete the existing role.`)],
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          existingRole = await interaction.guild.roles.create({
            name: createRoleName.trim(),
            reason: `Auto-created for marketplace item: ${name}`
          });
          console.log(`[Auto Role Create] Created role '${existingRole.name}' with ID ${existingRole.id}`);
          
          // Save to BotCreatedRole tracking collection
          const BotCreatedRole = require('../../database/models/BotCreatedRole');
          await BotCreatedRole.create({
            roleId: existingRole.id,
            roleName: existingRole.name,
            itemName: name
          }).catch(dbErr => console.error('Failed to log bot-created role to DB:', dbErr.message));
          
        } catch (createErr) {
          console.error(`❌ Failed to create role '${createRoleName}':`, createErr);
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ Failed to create role '${createRoleName}'. Please verify bot permissions and hierarchy to manage roles.`)],
            flags: MessageFlags.Ephemeral
          });
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
          existingItem.claimDurationDays = claimDurationDays || 30;
          existingItem.claimDurationMs = claimDurationMs;
          existingItem.createdAt = new Date();
          await existingItem.save();

          // Update live marketplace channel
          updateMarketplace(interaction.client);

          let successDesc = `✅ Inactive Marketplace item '${name}' has been reactivated!\n💰 Cost: **${pointCost}** points\n🎟️ Slots: **${totalSlots}**`;
          if (roleId) {
            successDesc += `\n🎭 **Role:** <@&${roleId}>`;
            let durStr = '';
            if (claimDurationDays > 0) durStr += `${claimDurationDays} days `;
            if (claimDurationHours > 0) durStr += `${claimDurationHours} hours `;
            if (claimDurationMinutes > 0) durStr += `${claimDurationMinutes} minutes `;
            if (!durStr) durStr = '30 days';
            successDesc += `\n⏳ **Duration:** **${durStr.trim()}**`;
          }
          if (expiresAt) {
            const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);
            successDesc += `\n⏰ **Market Expiry:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
          }

          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setDescription(successDesc)],
            flags: MessageFlags.Ephemeral
          });
        }

        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription(`❌ An active marketplace item named '${name}' already exists.`)],
          flags: MessageFlags.Ephemeral
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
        claimDurationDays: claimDurationDays || 30,
        claimDurationMs: claimDurationMs
      });
      await newItem.save();

      // Update live marketplace channel
      updateMarketplace(interaction.client);

      let replyDesc = `✅ Successfully added '**${name}**' to the marketplace!\n💰 Cost: **${pointCost}** points\n🎟️ Slots: **${totalSlots}**`;
      if (roleId) {
        replyDesc += `\n🎭 **Role:** <@&${roleId}>`;
        let durStr = '';
        if (claimDurationDays > 0) durStr += `${claimDurationDays} days `;
        if (claimDurationHours > 0) durStr += `${claimDurationHours} hours `;
        if (claimDurationMinutes > 0) durStr += `${claimDurationMinutes} minutes `;
        if (!durStr) durStr = '30 days';
        replyDesc += `\n⏳ **Duration:** **${durStr.trim()}**`;
      }
      if (expiresAt) {
        const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);
        replyDesc += `\n⏰ **Market Expiry:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
      }

      const replyEmbed = new EmbedBuilder()
        .setColor(0x00FF00) // Success green
        .setDescription(replyDesc);

      await interaction.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });

      // Send admin log
      const sendAdminLog = require('../../utils/sendAdminLog');
      await sendAdminLog(interaction.client, {
        action: 'Market Item Added',
        executor: interaction.user.tag,
        target: name,
        details: `Added new item/whitelist to the marketplace.`,
        fields: [
          { name: 'Point Cost', value: `${pointCost} pts`, inline: true },
          { name: 'Total Slots', value: `${totalSlots}`, inline: true },
          { name: 'Role Target', value: roleId ? `<@&${roleId}>` : 'None', inline: true }
        ],
        color: 0x9B59B6 // Purple
      });

    } catch (error) {
      console.error('Error in /addwlitem command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "❌ An error occurred. Please try again.", flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: "❌ An error occurred. Please try again.", flags: MessageFlags.Ephemeral });
        }
      } catch (err) {
        // Silently catch errors if interaction already finished/closed
      }
    }
  }
};
