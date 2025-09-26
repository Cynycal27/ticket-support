# ticket-support 
'''// -------------------- Imports --------------------
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionsBitField 
} = require("discord.js");
require("dotenv").config();

// -------------------- Create Client --------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// -------------------- When Bot is Ready --------------------
client.once("ready", () => {
    console.log(`${client.user.tag} is online!`);
});

// -------------------- Ticket Setup Command --------------------
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.content.toLowerCase() === "!ticket-setup") {
        const embed = new EmbedBuilder()
            .setTitle("🎫 Support Tickets")
            .setDescription("Click the button below to create a ticket.")
            .setColor("Blue");

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("create_ticket")
                .setLabel("Create Ticket")
                .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({ embeds: [embed], components: [button] });
    }
});

// -------------------- Ticket Button Handler --------------------
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "create_ticket") {
        const guild = interaction.guild;
        const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);

        if (existingChannel) {
            return interaction.reply({ content: "❌ You already have an open ticket!", ephemeral: true });
        }

        const ticketChannel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: 0, // GUILD_TEXT
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
                {
                    id: "STAFF_ROLE_ID_HERE", // Replace with staff role ID
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle("Support Ticket")
            .setDescription("A staff member will be with you shortly.\nClick the button below to close the ticket.")
            .setColor("Green");

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [button] });
        await interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.customId === "close_ticket") {
        await interaction.channel.delete();
    }
});

// -------------------- Login --------------------
client.login(process.env.TOKEN);'''
