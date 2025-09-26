// -------------------- Imports --------------------
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField } = require('discord.js');
require('dotenv').config();

// -------------------- Create Client --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// -------------------- Ticket Tracking --------------------
const tickets = new Map(); // Tracks claimed tickets

// -------------------- Status Rotation --------------------
const statuses = [
  '📩 ModMail Tickets!',
  '💬 Handling Messages!',
  '🛠 Staff Support!'
];
let i = 0;
const changeStatus = () => {
  client.user.setPresence({
    activities: [{ name: statuses[i], type: 3 }],
    status: 'online'
  }).catch(console.error);
  i = (i + 1) % statuses.length;
};

// -------------------- Ready Event --------------------
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  changeStatus();
  setInterval(changeStatus, 15000); // Rotate every 15 seconds
});

// -------------------- Helper: Ensure ModMail Structure --------------------
async function ensureModMailStructure(guild) {
  let category = guild.channels.cache.find(c => c.name === "ModMail Tickets" && c.type === 4);
  if (!category) {
    category = await guild.channels.create({
      name: "ModMail Tickets",
      type: 4, // Category
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] } // Everyone denied
      ]
    });
  }

  let transcriptChannel = guild.channels.cache.find(c => c.name === "modmail-transcripts" && c.type === 0);
  if (!transcriptChannel) {
    transcriptChannel = await guild.channels.create({
      name: "modmail-transcripts",
      type: 0, // Text
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });
  }

  return { category, transcriptChannel };
}

// -------------------- Slash Command Handler --------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: "This command must be run in a server.", ephemeral: true });

  const { category, transcriptChannel } = await ensureModMailStructure(guild);

  try {
    if (commandName === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle("📌 ModMail Bot Commands")
        .setColor("#1E90FF")
        .addFields(
          { name: "/close", value: "Close this ticket" },
          { name: "/claim", value: "Claim a ticket as staff" },
          { name: "/transcript", value: "Send transcript of ticket to the transcript channel" },
          { name: "/rename", value: "Rename the ticket" },
          { name: "/help", value: "Display this help message" }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    if (commandName === 'close') {
      if (!tickets.has(interaction.channel.id))
        return interaction.reply({ content: "This is not a ticket channel.", ephemeral: true });

      const closeEmbed = new EmbedBuilder()
        .setTitle("🛑 Ticket Closed")
        .setColor("#FF0000")
        .setDescription(`This ticket has been closed by **${interaction.user.tag}**.`)
        .setFooter({ text: "Closed" })
        .setTimestamp();

      await interaction.reply({ embeds: [closeEmbed] });
      tickets.delete(interaction.channel.id);
      return setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }

    if (commandName === 'claim') {
      if (tickets.has(interaction.channel.id))
        return interaction.reply({ content: `Already claimed by ${tickets.get(interaction.channel.id).tag}`, ephemeral: true });

      tickets.set(interaction.channel.id, interaction.user);
      const claimEmbed = new EmbedBuilder()
        .setTitle("✅ Ticket Claimed")
        .setColor("#00FF00")
        .setDescription(`Claimed by **${interaction.user.tag}**`)
        .setTimestamp();
      return interaction.reply({ embeds: [claimEmbed] });
    }

    if (commandName === 'transcript') {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      let content = messages.map(m => `${m.author.tag}: ${m.content}`).reverse().join("\n");
      if (content.length > 2000) content = content.slice(0, 1990) + "\n...truncated";

      const transcriptEmbed = new EmbedBuilder()
        .setTitle(`📄 Transcript: ${interaction.channel.name}`)
        .setDescription(content || "No messages found.")
        .setColor("#800080")
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      await transcriptChannel.send({ embeds: [transcriptEmbed] });
      return interaction.reply({ content: "Transcript sent!", ephemeral: true });
    }

    if (commandName === 'rename') {
      const newName = interaction.options.getString("name");
      if (!newName) return interaction.reply({ content: "Please provide a new name.", ephemeral: true });
      await interaction.channel.setName(newName);
      return interaction.reply({ content: `Channel renamed to ${newName}`, ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
  }
});

// -------------------- DM Handling --------------------
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // DM → Ticket
  if (message.channel.type === 1) {
    for (const guild of client.guilds.cache.values()) {
      const { category } = await ensureModMailStructure(guild);

      // Check if ticket exists
      let ticket = guild.channels.cache.find(c => c.topic === message.author.id);
      if (!ticket) {
        ticket = await guild.channels.create({
          name: `ticket-${message.author.username}`,
          type: 0,
          parent: category.id,
          topic: message.author.id,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }
          ]
        });

        const newTicketEmbed = new EmbedBuilder()
          .setTitle("📩 New ModMail Ticket")
          .setColor("#00FF00")
          .setThumbnail(message.author.displayAvatarURL())
          .addFields(
            { name: "User", value: `${message.author.tag}`, inline: true },
            { name: "User ID", value: `${message.author.id}`, inline: true }
          )
          .setFooter({ text: "Ticket created" })
          .setTimestamp();

        ticket.send({ embeds: [newTicketEmbed] });
      }

      const userEmbed = new EmbedBuilder()
        .setAuthor({ name: `${message.author.tag} (User)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content)
        .setColor("#1E90FF")
        .setFooter({ text: "Message received" })
        .setTimestamp();

      ticket.send({ embeds: [userEmbed] });
    }
  }

  // Staff → DM User
  else if (message.guild && tickets.has(message.channel.id)) {
    const userId = message.channel.topic;
    if (!userId) return;
    try {
      const user = await client.users.fetch(userId);
      const staffEmbed = new EmbedBuilder()
        .setAuthor({ name: `${message.author.tag} (Staff)`, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content)
        .setColor("#FFA500")
        .setFooter({ text: "Reply from staff" })
        .setTimestamp();

      user.send({ embeds: [staffEmbed] });
    } catch {
      console.log("❌ Could not DM user.");
    }
  }
});

// -------------------- Login --------------------
client.login(process.env.TOKEN);
