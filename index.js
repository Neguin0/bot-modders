const {
default: WASocket,
	useSingleFileAuthState,
	downloadContentFromMessage,
	prepareWAMessageMedia,
	generateWAMessageFromContent,
	generateMessageID,
	WA_DEFAULT_EPHEMERAL,
	getMessageFromStore,
	Mimetype
} = require('@adiwajshing/baileys');
const Pino = require('pino');
const axios = require('axios').default;
const path = require('path').join;
const {
	Boom
} = require('@hapi/boom');
const {
	state,
	saveState
} = useSingleFileAuthState(path('session.json'), Pino({
		level: 'silent'
	}));
const checkVersion = async () => {
	let BASE_URL = 'https://web.whatsapp.com/check-update?version=1&platform=web';
	const {
		data: JSONData
	} = await axios.get(BASE_URL);
	let version = JSONData.currentVersion.split('.').map(v => parseInt(v));
	return version;
};
const fs = require('fs');
const {
	writeFile
} = require('fs/promises');
const app = require('express')();

const {
	Tool,
	Color,
	DB,
	TicTacToe,
	SaveDB,
	Prefix,
} = require('./lib');

const connect = async () => {
	let version = await checkVersion();
	const client = WASocket({
		printQRInTerminal: true,
		auth: state,
		logger: Pino({
			level: 'silent'
		}),
		version
	});
	client.ev.on('creds.update', saveState);
	client.ev.on('connection.update', async (up) => {
		try {
			const {
				lastDisconnect, connection
			} = up;
			if (connection) console.log(`Status de Conexão:${Color.amarelo} ${connection}${Color.reset}`);
			let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
			const resReason = {
				500() {
					console.log('Arquivo de sessão inválido, exclua a sessão e verifique novamente.'); process.exit();
				},
				428() {
					console.log('Conexão fechada, reconectando....'); connect()
				},
				408() {
					console.log('Conexão perdida do servidor, reconectando...'); connect()
				},
				440() {
					console.log('Conexão substituída, outra nova sessão aberta, feche a sessão atual primeiro.'); process.exit();
				},
				401() {
					console.log(`Dispositivo desconectado, exclua a sessao e digitalizar novamente.`); process.exit();
				},
				410() {
					console.log('Reinicialização necessária, reiniciando...'); connect()
				},
			}
			if (connection === 'close') {
				if (resReason[reason]) resReason[reason]();
				else console.log(`Razão de Desconexão Desconhecida: ${reason}|${connection}|${lastDisconnect}`),
				connect();
			}
		} catch (e) {
			console.log(`${Color.vermelho}Error => Session: ${Color.reset}${e}`);
		}
	})
	client.ev.on('group-participants.update',
		data => {});
	client.ev.on('messages.upsert',
		async (m) => {
			try {
				if (!m.messages[0]) return;
				if (m.type !== 'notify') return;
				const dados = m.messages[0];
				if (dados.key.remoteJid === 'status@broadcast') return;
				const jid = dados.key.remoteJid;
				var id = dados.key.participant || dados.key.remoteJid;
				id = id.replace(/:.+@/, '@');
				const jidBot = client.user.id.replace(/:.+@/, '@');
				const nick = dados.pushName;
				const info = dados.message;
				const type = dados && dados.message ? Object.keys(info)[0]: '';
				const msg =
				info && info.extendedTextMessage ?
				info.extendedTextMessage.text:
				info && info.conversation ?
				info.conversation:
				info && info.imageMessage && info.imageMessage.caption ?
				info.imageMessage.caption:
				info && info.videoMessage && info.videoMessage.caption ?
				info.videoMessage.caption: '';
				const msgMarked =
				info &&
				info.extendedTextMessage &&
				info.extendedTextMessage.contextInfo &&
				info.extendedTextMessage.contextInfo.quotedMessage &&
				info.extendedTextMessage.contextInfo.quotedMessage.conversation ?
				info.extendedTextMessage.contextInfo.quotedMessage.conversation: '';
				const mentioned =
				info &&
				info.extendedTextMessage &&
				info.extendedTextMessage.contextInfo &&
				info.extendedTextMessage.contextInfo.participant ?
				info.extendedTextMessage.contextInfo.participant: '';
				const mentions =
				info &&
				info.extendedTextMessage &&
				info.extendedTextMessage.contextInfo &&
				info.extendedTextMessage.contextInfo.mentionedJid ?
				info.extendedTextMessage.contextInfo.mentionedJid: '';
				const cmd = msg.startsWith(Prefix) ? msg.split(' ')[0].slice(1).toLowerCase(): null
				const text = cmd ? msg.slice(cmd.length + 2): '';
				const args = text.split(' ');
				const reply = texto => client.sendMessage(jid, {
					text: texto
				}, {
					quoted: dados,
					ephemeralExpiration: false
				});
				const react = emoji => client.sendMessage(jid, {
					react: {
						text: emoji, key: dados.key
					}});
				const send = texto => client.sendMessage(jid, {
					text: texto
				}, {
					ephemeralExpiration: false
				});
				const sendTo = (to, texto) => client.sendMessage(to, {
					text: texto
				}, {
					ephemeralExpiration: false
				});
				const replyJson = texto => client.sendMessage(jid, {
					text: JSON.stringify(texto, null, '\t'), quoted: dados
				}, {
					ephemeralExpiration: false
				});
				const mention = (texto, mark) => client.sendMessage(jid, {
					text: texto, mentions: [addMentionsInArray(texto)]
				}, (mark ? {
						quoted: dados,
						ephemeralExpiration: false
					}: {}), {
					ephemeralExpiration: false
				});
				const mentionArray = (texto, ment, mark) => client.sendMessage(jid, {
					text: texto, mentions: ment
				}, (mark ? {
						quoted: dados,
						ephemeralExpiration: false
					}: {
						ephemeralExpiration: false
					}));
				const addMentionsInArray = (texto) => {
					const re = /@[0-9]+/g
					if (!re.test(texto)) return [];
					var mentioneds = [];
					for (let i of texto.match(re))
						mentioneds.push(i.replace(/@/g, '') + '@s.whatsapp.net');
					return mentioneds;
				};
				const isDono = DB.Dono.includes(id);
				const isGroup = jid.endsWith('@g.us');
				const groupMetadata = isGroup ? await client.groupMetadata(jid): '';
				const groupName = isGroup ? groupMetadata.subject: '';
				const groupMembers = isGroup ? groupMetadata.participants: '';
				const groupAdmins = isGroup ? Tool.getGroupAdmins(groupMembers): '';
				const isBotGroupAdmins = groupAdmins.includes(jidBot);
				const isGroupAdmins = groupAdmins.includes(id);
				const selo = {
					'key': {
						participant: '0@s.whatsapp.net',
						remoteJid: '120363024204176988@g.us',
					},
					'message': {
						'imageMessage': {
							'jpegThumbnail': ''
						}
					}
				}
				const relayMsg = (content) => client.relayMessage(jid, content, {
					messageId: generateMessageID(), additionalAttributes: {}
				});
				const botao =
				info &&
				info.buttonsResponseMessage &&
				info.buttonsResponseMessage.selectedButtonId ?
				info.buttonsResponseMessage.selectedButtonId: '';
				const butaoTamplate =
				info &&
				info.templateButtonReplyMessage &&
				info.templateButtonReplyMessage.selectedId ?
				info.templateButtonReplyMessage.selectedId: '';
				const listRow =
				info &&
				info.listResponseMessage &&
				info.listResponseMessage.singleSelectReply &&
				info.listResponseMessage.singleSelectReply.selectedRowId ?
				info.listResponseMessage.singleSelectReply.selectedRowId: '';
				const listTitle =
				info &&
				info.listResponseMessage &&
				info.listResponseMessage.contextInfo &&
				info.listResponseMessage.contextInfo.quotedMessage &&
				info.listResponseMessage.contextInfo.quotedMessage.listMessage &&
				info.listResponseMessage.contextInfo.quotedMessage.listMessage.sections &&
				info.listResponseMessage.contextInfo.quotedMessage.listMessage.sections[0].title ?
				info.listResponseMessage.contextInfo.quotedMessage.listMessage.sections[0].title: '';

				//================ [GATILHO] ==================
				if (cmd && !isGroup) console.log(`${Color.verde}[CMD] ${Color.reset}${msg} ${Color.amarelo}de ${Color.azul}${nick}${Color.reset}`);
				if (cmd && isGroup) console.log(`${Color.verde}[CMD] ${Color.reset}${msg} ${Color.amarelo}de ${Color.azul}${nick} ${Color.amarelo}em ${Color.azul}${groupName}${Color.reset}`);
				if (cmd) client.sendReadReceipt(jid, id, [dados.key.id]);
				switch (cmd) {
					case 'exc':
						if (!isDono) return reply('*Comando apenas para o dono!*');
						try {
							eval(`
								(async () => {
								try {
								${text}
								} catch (err) { reply(String(err))}
								})()
								`);
						} catch (err) {
							reply(String(err));
						}
						break
					case 'cpf':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						var query = text.replace(/\.|\-|\(|\)|\+/gi, "");
						if (query.length < 11 || query.length > 11) return await reply(Prefix+"cpf 00000000868");
						if (isNaN(query)) return await reply("Apenas números!")
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=cpf&q="+query));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'cpf2':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						var query = text.replace(/\.|\-|\(|\)|\+/gi, "");
						if (query.length < 11 || query.length > 11) return await reply(Prefix+"cpf2 00000000868");
						if (isNaN(query)) return await reply("Apenas números!")
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=cpf2&q="+query));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'cpf3':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						var query = text.replace(/\.|\-|\(|\)|\+/gi, "");
						if (query.length < 11 || query.length > 11) return await reply(Prefix+"cpf3 00000000868");
						if (isNaN(query)) return await reply("Apenas números!")
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=cpf3&q="+query));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'tel':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						var query = text.replace(/\.|\-|\(|\)|\+/gi, "");
						if (query.length < 11 || query.length > 11) return await reply(Prefix+"tel 11999999999");
						if (isNaN(query)) return await reply("Apenas números!")
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=telefone&q="+query));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'placa':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						var query = text.replace(/\.|\-|\(|\)|\+/gi, "");
						if (query.length < 7 || query.length > 7) return await reply(Prefix+"placa abc1234");
						if (isNaN(query)) return await reply("Apenas números!")
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=placa&q="+query));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'cnpj':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						var query = text.replace(/\.|\-|\(|\)|\+|\//gi, "");
						if (query.length < 14 || query.length > 14) return await reply(Prefix+"cnpj 18236120000158");
						if (isNaN(query)) return await reply("Apenas números!")
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=cnpj&q="+query));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'cns':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						var query = text.replace(/\.|\-|\(|\)|\+|\//gi, "");
						if (query.length < 15 || query.length > 15) return await reply(Prefix+"cns 700802423158685");
						if (isNaN(query)) return await reply("Apenas números!")
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=cns&q="+query));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'nome':
						//if (!isDono) return reply('*Comando apenas para o dono!*');
						if (text.length < 1) return await reply(Prefix+"nome Jair Messias Bolsonaro");
						await reply("Consultando...")
						var {
							data
						} = await axios(encodeURI("https://neguin-buscas.herokuapp.com/puxar?token=modders&type=nome&q="+text));
						if (data && data.result && data.http_code === 200) {
							await reply(data.result.trim());
						} else if (data && data.http_code) {
							await reply(`Não foi possível fazer a consulta.\nHTTP_CODE: ${data.http_code}\nResponse: ${data.error}`)
						} else await reply("Servidor não respondeu.")
						break
					case 'menu':
						await reply(`*💻 Menu Bot Modders*\n\`\`\`Consultas Gratuitas\`\`\`\n\n→ ${Prefix}cpf\n→ ${Prefix}cpf2\n→ ${Prefix}cpf3\n→ ${Prefix}tel\n→ ${Prefix}nome\n→ ${Prefix}cnpj\n→ ${Prefix}cns\n→ ${Prefix}placa`);
						break
				}
			} catch (e) {
				console.log(`${Color.vermelho}Error => Events/msg.js: ${Color.reset}${e}`)
			}
		});
};
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.json({
	status_code: 200
}));
app.listen(port, () => console.log('WebSite Online:', port));
connect();