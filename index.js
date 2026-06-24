const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    ChannelType, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    AttachmentBuilder,
    ModalBuilder,        // ✅ AJOUTÉ
    TextInputBuilder,    // ✅ AJOUTÉ
    TextInputStyle       // ✅ AJOUTÉ
} = require('discord.js'); 

// ========================================== 
// CONFIGURATION DU BOT (À MODIFIER PAR TOI) 
// ========================================== 
const config = { 
    token: process.env.TOKEN,
    clientId: "1518731453230223580", 
    guildId: "1476597265429827708", 
    prefix: "+", 

    autoRoleId: "1505350715772502136", 
    supportRoleId: "1518716795236651159", 

    ticketCategoryId: "1518741942123364524", 
    logChannelId: "1518741088985288894", 

    moderatorIds: ["1518716923091615844"],

    roles: {
        patron:       "1518716923091615844",
        coPatron:     "1518716948123222016",
        direction:    "1518716795236651159",
        mecanoConf:   "1518717015089742006",
        mecano:       "1518723522342551763",
        stagiaire:    "1518723564944097290"
    }
}; 

const client = new Client({ 
    intents: [ 
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers 
    ], 
    partials: [Partials.Message, Partials.Channel, Partials.Reaction] 
}); 

const spamMap = new Map(); 

// ========================================== 
// ÉVÉNEMENT : BOT EN LIGNE ET SLASH COMMANDS 
// ========================================== 
client.on('ready', async () => { 
    console.log(`✅ Connecté en tant que ${client.user.tag} ! Prêt pour LS Custom.`); 

    const commands = [ 
        new SlashCommandBuilder() 
            .setName('lscustom') 
            .setDescription('Affiche le menu des embeds LS Custom'),
        new SlashCommandBuilder()           // ✅ AJOUTÉ
            .setName('embedcustom') 
            .setDescription('Créer un embed personnalisé via formulaire')
    ].map(command => command.toJSON()); 

    const rest = new REST({ version: '10' }).setToken(config.token); 
    try { 
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands }); 
        console.log('✅ Commandes Slash (/) chargées avec succès.'); 
    } catch (error) { 
        console.error('❌ Erreur lors du chargement des commandes Slash :', error); 
    } 
}); 

client.on('guildMemberAdd', async member => { 
    try { 
        const role = member.guild.roles.cache.get(config.autoRoleId); 
        if (role) { 
            await member.roles.add(role); 
        } 
    } catch (error) { 
        console.error('Erreur Auto-Role:', error); 
    } 
}); 

async function generateTranscript(channel) { 
    let allMessages = []; 
    let lastId; 
    
    while (true) { 
        const options = { limit: 100 }; 
        if (lastId) options.before = lastId; 
        const messages = await channel.messages.fetch(options).catch(() => null); 
        if (!messages || messages.size === 0) break; 
        allMessages.push(...messages.values()); 
        lastId = messages.last().id; 
    } 
    allMessages.reverse(); 

    let html = ` 
    <!DOCTYPE html> 
    <html lang="fr"> 
    <head> 
        <meta charset="utf-8"> 
        <title>Transcript - ${channel.name}</title> 
        <style> 
            body { background-color: #36393f; color: #dcddde; font-family: Arial, sans-serif; padding: 20px; } 
            .info { background: #2f3136; padding: 15px; border-radius: 5px; margin-bottom: 20px; } 
            .message { margin-bottom: 20px; display: flex; align-items: flex-start; } 
            .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; object-fit: cover; } 
            .header { margin-bottom: 5px; } 
            .username { font-weight: bold; color: #fff; margin-right: 10px; } 
            .timestamp { color: #72767d; font-size: 0.8em; } 
            .content { line-height: 1.4; word-wrap: break-word; white-space: pre-wrap; } 
        </style> 
    </head> 
    <body> 
        <div class="info"> 
            <h1>🔧 LS Custom - Log de Ticket</h1> 
            <p><strong>Ticket :</strong> ${channel.name}</p> 
        </div> 
    `; 

    allMessages.forEach(msg => { 
        if (!msg.author) return; 

        const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png'; 
        const time = msg.createdAt.toLocaleString('fr-FR'); 
        const content = msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
        
        html += ` 
        <div class="message"> 
            <img src="${avatarUrl}" class="avatar" alt="Avatar"> 
            <div> 
                <div class="header"> 
                    <span class="username">${msg.author.tag}</span> 
                    <span class="timestamp">${time}</span> 
                </div> 
                <div class="content">${content}</div> 
            </div> 
        </div>`; 
    }); 

    html += `</body></html>`; 
    return html; 
} 

client.on('messageCreate', async message => { 
    if (message.author.bot) return; 

    const isModerator = config.moderatorIds.includes(message.author.id) || message.member.permissions.has(PermissionsBitField.Flags.Administrator); 

    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi; 
    if (linkRegex.test(message.content) && !isModerator) { 
        await message.delete().catch(() => {}); 
        return message.channel.send(`⚠️ ${message.author}, les liens ne sont pas autorisés ici.`).then(m => setTimeout(() => m.delete(), 5000)); 
    } 

    if (!isModerator) { 
        if (spamMap.has(message.author.id)) { 
            const userData = spamMap.get(message.author.id); 
            const difference = Date.now() - userData.lastMessage; 

            if (difference < 2500) { 
                userData.msgCount++; 
                if (userData.msgCount >= 4) { 
                    await message.delete().catch(() => {}); 
                    await message.member.timeout(5 * 60 * 1000, "Spam").catch(() => {}); 
                    return message.channel.send(`⛔ ${message.author} a été mis sous silence pour spam pendant 5 minutes.`); 
                } 
            } else { 
                userData.msgCount = 1; 
            } 
            userData.lastMessage = Date.now(); 
        } else { 
            spamMap.set(message.author.id, { msgCount: 1, lastMessage: Date.now() }); 
        } 
    } 

    if (!message.content.startsWith(config.prefix)) return; 

    const args = message.content.slice(config.prefix.length).trim().split(/ +/); 
    const command = args.shift().toLowerCase(); 

    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle("📜 Menu d'Aide - LS Custom")
            .setColor("#ff6600")
            .setDescription(`
                Voici la liste des commandes disponibles :
                
                **🛠️ Modération :**
                \`+kick @user\` - Expulse un membre.
                \`+ban @user\` - Bannit un membre.
                \`+mute @user [min]\` - Rend un membre muet.
                
                **🎟️ Tickets :**
                \`+ticketsetup\` - Lance le bouton de ticket.
                \`+rename [nom]\` - Renomme le ticket actuel.
                \`+add @user\` - Ajoute un membre au ticket.
                \`+del @user\` - Retire un membre du ticket.
                \`+close\` - Ferme et archive le ticket.
                
                **📢 Embeds :**
                \`+embed annonce [texte]\`
                \`+embed reglement\`
                \`+embed hierarchie\`
                
                **✨ Slash Commands :**
                \`/embedcustom\` - Créer un embed personnalisé.
            `);
        return message.reply({ embeds: [helpEmbed] });
    }

    if (['ban', 'kick', 'mute', 'embed', 'ticketsetup'].includes(command) && !isModerator) { 
        return message.reply("⛔ Tu n'es pas dans la whitelist pour utiliser cette commande."); 
    } 

    if (command === 'kick') { 
        const target = message.mentions.members.first(); 
        if (!target) return message.reply("Mentionne un membre à expulser."); 
        await target.kick("Expulsé par un modérateur LS Custom").catch(console.error); 
        message.reply(`✅ ${target.user.tag} a été expulsé.`); 
    } 

    if (command === 'ban') { 
        const target = message.mentions.members.first(); 
        if (!target) return message.reply("Mentionne un membre à bannir."); 
        await target.ban({ reason: "Banni par un modérateur LS Custom" }).catch(console.error); 
        message.reply(`✅ ${target.user.tag} a été banni.`); 
    } 

    if (command === 'mute') { 
        const target = message.mentions.members.first(); 
        const duration = parseInt(args[1]) || 10; 
        if (!target) return message.reply("Mentionne un membre à rendre muet. (ex: +mute @user 15)"); 
        await target.timeout(duration * 60 * 1000, "Mute manuel").catch(console.error); 
        message.reply(`✅ ${target.user.tag} a été rendu muet pour ${duration} minutes.`); 
    } 

    if (command === 'ticketsetup') { 
    const embed = new EmbedBuilder() 
        .setTitle("🔧 LS Custom - Accueil & Support") 
        .setDescription("Bienvenue au **LS Custom** !\n\nMerci de choisir le type de demande en cliquant sur l'un des boutons ci-dessous :\n\n🛠️ **Aide Mechanic** : Pour un devis, une réparation ou une customisation.\n📝 **Recrutement** : Pour déposer ta candidature et rejoindre l'équipe.") 
        .setColor("#00246B"); 

    const row = new ActionRowBuilder().addComponents( 
        new ButtonBuilder() 
            .setCustomId('create_ticket_meca') // Nouvel ID pour le mécano
            .setLabel('Aide Mechanic') 
            .setEmoji('🛠️') 
            .setStyle(ButtonStyle.Primary),
            
        new ButtonBuilder() 
            .setCustomId('create_ticket_recrutement') // Nouvel ID pour le recrutement
            .setLabel('Recrutement') 
            .setEmoji('📝') 
            .setStyle(ButtonStyle.Success) // Bouton vert pour différencier
    ); 

    message.channel.send({ embeds: [embed], components: [row] }); 
    message.delete(); 
}

    if (command === 'embed') {
    const type = args[0]?.toLowerCase();

    // Couleur : dernier argument si c'est un hex, sinon orange par défaut
    const lastArg = args[args.length - 1];
    const hexRegex = /^#([0-9A-Fa-f]{6})$/;
    const color = hexRegex.test(lastArg) ? lastArg : '#ff6600';

    if (type === 'annonce') {
        // Retire la couleur du texte si elle a été passée
        const textArgs = hexRegex.test(lastArg) ? args.slice(1, -1) : args.slice(1);
        const text = textArgs.join(" ").replace(/\\n/g, '\n');
        if (!text) return message.reply("Précise le texte de l'annonce ! (ex: `+embed annonce Mon texte #ff0000`)");

        const embed = new EmbedBuilder()
            .setTitle("📢 Annonce LS Custom")
            .setDescription(text)
            .setColor(color);

        message.channel.send({ embeds: [embed] });
        message.delete();
    }
    else if (type === 'reglement') {
        const embed = new EmbedBuilder()
            .setTitle("📜 RÈGLEMENT INTERNE — LS CUSTOM")
            .setColor(color)
            .setDescription(`
            **1. Professionnalisme :** Sois poli et respectueux avec tous les clients. 
            **2. Tenue :** Obligatoire en service. 
            **3. Zone Neutre :** Pas d'agressivité dans l'atelier. 
            **4. Véhicules :** Usage personnel interdit. 
            **5. Facturation :** Immédiate et obligatoire. 
            **6. Crédits :** Interdits. Le client paie avant de partir. 
            **7. Vole :** Garder l'argent de la caisse est sanctionné gravement. 
            **8. Dépanneuse :** Usage pro uniquement, conduite sécurisée exigée. 
            **9. Hiérarchie :** Respecte les directives des patrons. 
            *Tout manquement aux règles sera sanctionné.*`);

        message.channel.send({ embeds: [embed] });
        message.delete();
    }
    else if (type === 'hierarchie') {
    await message.guild.members.fetch();

    const getRoleMembers = (roleId) => {
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return '`Place Libre`';
        const members = role.members.map(m => `<@${m.id}>`).join(' **//** ');
        return members || '`Place Libre`';
    };

     const embed = new EmbedBuilder()
        .setTitle("👑 Hiérarchie LS Custom")
        .setColor(color)
        .setDescription("━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        .addFields(
            { name: '👑 Patron', value: getRoleMembers(config.roles.patron), inline: false },
            { name: '​', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '🥈 Co-Patron', value: getRoleMembers(config.roles.coPatron), inline: false },
            { name: '​', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '📋 Direction', value: getRoleMembers(config.roles.direction), inline: false },
            { name: '​', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '🔧 Mécano Confirmé', value: getRoleMembers(config.roles.mecanoConf), inline: false },
            { name: '​', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '🔩 Mécano', value: getRoleMembers(config.roles.mecano), inline: false },
            { name: '​', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '🎓 Stagiaire', value: getRoleMembers(config.roles.stagiaire), inline: false },
        )
        .setFooter({ text: 'LS Custom — Équipe officielle' })
        .setTimestamp();

    message.channel.send({ embeds: [embed] });
    message.delete();
}
}

    const isTicket = message.channel.parentId === config.ticketCategoryId; 

    if (command === 'rename') { 
        if (!isTicket) return message.reply("❌ Cette commande ne fonctionne que dans un ticket."); 
        if (!isModerator) return message.reply("⛔ Seul le staff peut renommer un ticket."); 
        const newName = args.join("-"); 
        if (!newName) return message.reply("⚠️ Précise un nouveau nom (ex: `+rename devis-moteur`)."); 
        await message.channel.setName(newName).catch(console.error); 
        message.reply(`✅ Le ticket a été renommé en \`${newName}\`.`); 
    } 

    if (command === 'add') { 
        if (!isTicket) return message.reply("❌ Cette commande ne fonctionne que dans un ticket."); 
        if (!isModerator) return message.reply("⛔ Seul le staff peut ajouter quelqu'un."); 
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]); 
        if (!target) return message.reply("⚠️ Mentionne ou donne l'ID du membre à ajouter."); 
        await message.channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true }); 
        message.reply(`✅ ${target} a été ajouté au ticket.`); 
    } 

    if (command === 'del') { 
        if (!isTicket) return message.reply("❌ Cette commande ne fonctionne que dans un ticket."); 
        if (!isModerator) return message.reply("⛔ Seul le staff peut retirer quelqu'un."); 
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]); 
        if (!target) return message.reply("⚠️ Mentionne ou donne l'ID du membre à retirer."); 
        await message.channel.permissionOverwrites.edit(target.id, { ViewChannel: false, SendMessages: false }); 
        message.reply(`✅ ${target} a été retiré du ticket.`); 
    } 

    if (command === 'close') { 
        if (!isTicket) return message.reply("❌ Cette commande ne fonctionne que dans un ticket."); 
        if (!isModerator) return message.reply("⛔ Seul le staff peut fermer ce ticket."); 
        await message.reply("🔒 Le ticket va être fermé dans 5 secondes et sauvegardé..."); 
        const logChannel = message.guild.channels.cache.get(config.logChannelId); 
        if (logChannel) { 
            const transcriptHtml = await generateTranscript(message.channel); 
            const buffer = Buffer.from(transcriptHtml, 'utf-8'); 
            const attachment = new AttachmentBuilder(buffer, { name: `transcript-${message.channel.name}.html` }); 
            const logEmbed = new EmbedBuilder() 
                .setTitle("🔒 Ticket Fermé (via commande)") 
                .addFields( 
                    { name: "Nom du ticket", value: message.channel.name, inline: true }, 
                    { name: "Fermé par", value: message.author.tag, inline: true } 
                ) 
                .setColor("Red") 
                .setTimestamp(); 
            await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(console.error); 
        } 
        setTimeout(() => message.channel.delete().catch(console.error), 5000); 
    } 
}); 

// ==========================================
// INTERACTIONS (slash commands, boutons, modals)
// ✅ TOUT dans UN SEUL client.on('interactionCreate')
// ==========================================
client.on('interactionCreate', async interaction => { 

    // --- SLASH COMMANDS ---
    if (interaction.isChatInputCommand()) { 
        if (interaction.commandName === 'lscustom') { 
            const embed = new EmbedBuilder() 
                .setTitle("🛠️ Menu Système LS Custom") 
                .setDescription("Bienvenue dans l'interface bot. Utilisez les commandes prefix (`+`) pour interagir pleinement.") 
                .setColor("#ff6600"); 
            await interaction.reply({ embeds: [embed], ephemeral: true }); 
        }

        if (interaction.commandName === 'embedcustom') {
            const modal = new ModalBuilder()
                .setCustomId('embed_modal')
                .setTitle('Créer un Embed LS Custom');

            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Titre de l\'embed')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('desc')
                .setLabel('Description de l\'embed')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput)
            );

            await interaction.showModal(modal);
        }
    }

    // --- MODAL SUBMIT ---
    if (interaction.isModalSubmit() && interaction.customId === 'embed_modal') {
        const title = interaction.fields.getTextInputValue('title');
        const desc = interaction.fields.getTextInputValue('desc');
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor("#ff6600");
        await interaction.reply({ embeds: [embed] });
    }

    // --- BOUTONS ---
    if (interaction.isButton()) { 
    if (interaction.customId === 'create_ticket') { 
        const channelName = `ticket-${interaction.user.username}`; 
        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName.toLowerCase()); 
        if (existingChannel) return interaction.reply({ content: "❌ Vous avez déjà un ticket ouvert !", ephemeral: true }); 

        const ticketChannel = await interaction.guild.channels.create({ 
            name: channelName, 
            type: ChannelType.GuildText, 
            parent: config.ticketCategoryId, 
            permissionOverwrites: [ 
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
                { id: config.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] } 
            ] 
        }); 

        await interaction.reply({ content: `✅ Ticket créé avec succès : ${ticketChannel}`, ephemeral: true }); 

        // --- NOUVEL EMBED PLUS BEAU ---
        const welcomeEmbed = new EmbedBuilder() 
            .setAuthor({ name: "Support LS Custom", iconURL: interaction.guild.iconURL() })
            .setTitle("🎟️ Nouveau Ticket Ouvert") 
            .setDescription(`Bienvenue ${interaction.user} dans ton espace privé !\n\nUn membre de l'équipe <@&${config.supportRoleId}> va s'occuper de toi sous peu. En attendant, merci de nous donner un maximum de détails.`) 
            .addFields(
                { name: '📋 Pour aller plus vite :', value: '• Quel est le modèle du véhicule ?\n• Quelles sont les modifications souhaitées ?\n• Quel est ton budget approximatif ?' }
            )
            .setColor("#00246B")
            .setFooter({ text: "Ticket généré par LS Custom", iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp(); // Ajoute l'heure en bas de l'embed

        const closeBtn = new ActionRowBuilder().addComponents( 
            new ButtonBuilder() 
                .setCustomId('close_ticket') 
                .setLabel('Fermer le ticket') 
                .setEmoji('🔒') 
                .setStyle(ButtonStyle.Danger) 
        ); 

        // J'ai séparé le ping du staff du message principal pour que l'embed soit bien mis en valeur
        ticketChannel.send({ content: `🔔 Alerte équipe : <@&${config.supportRoleId}>`, embeds: [welcomeEmbed], components: [closeBtn] }); 
    } 

    // --- LE RESTE DE TON CODE (FERMETURE) RESTE IDENTIQUE ---
    if (interaction.customId === 'close_ticket') { 
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && !config.moderatorIds.includes(interaction.user.id)) { 
            return interaction.reply({ content: "❌ Seul le staff LS Custom peut fermer ce ticket.", ephemeral: true }); 
        } 
        await interaction.reply("🔒 Le ticket va être fermé dans 5 secondes et sauvegardé..."); 
        const logChannel = interaction.guild.channels.cache.get(config.logChannelId); 
        if (logChannel) { 
            const transcriptHtml = await generateTranscript(interaction.channel); 
            const buffer = Buffer.from(transcriptHtml, 'utf-8'); 
            const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.html` }); 
            const logEmbed = new EmbedBuilder() 
                .setTitle("🔒 Ticket Fermé (via bouton)") 
                .addFields( 
                    { name: "Nom du ticket", value: interaction.channel.name, inline: true }, 
                    { name: "Fermé par", value: interaction.user.tag, inline: true } 
                ) 
                .setColor("Red") 
                .setTimestamp(); 
            await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(console.error); 
        } 
        setTimeout(() => interaction.channel.delete().catch(console.error), 5000); 
    } 
}
}); // ✅ UNE SEULE accolade fermante ici

const http = require('http');
http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 8080);

client.login(config.token);
