const { jidNormalizedUser, proto, areJidsSameUser, extractMessageContent, downloadContentFromMessage, toBuffer, getDevice, generateForwardMessageContent, generateWAMessageFromContent, prepareMessageFromContent, getContentType } = require('@whiskeysockets/baileys')
const baileys = require("@whiskeysockets/baileys")
const fs = require("fs")
const path = require("path")
const { parsePhoneNumber } = require("libphonenumber-js")
const { fileURLToPath } = require("url")

const config = require("../config.js")
const Function = require("./function.js")

exports.Client = async function({ sock, store }) {
   delete store.groupMetadata
   
   for (let v in store) {
      sock[v] = store[v]
   }

const client = Object.defineProperties(sock, {
copyNForward: {
  async value(jid, message, forceForward = false, options = {}) {
        let mtype = Object.keys(message.message)[0]
        let content = await baileys.generateForwardMessageContent(message, forceForward)
        let ctype = Object.keys(content)[0]
		let context = {}
        if (mtype != "conversation") context = message.message[mtype].contextInfo
        content[ctype].contextInfo = {
            ...context,
            ...content[ctype].contextInfo
        }
        const waMessage = await baileys.generateWAMessageFromContent(jid, content, options ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo ? {
                contextInfo: {
                    ...content[ctype].contextInfo,
                    ...options.contextInfo
                }
            } : {})
        } : {})
        await sock.relayMessage(jid, waMessage.message, { messageId:  waMessage.key.id })
        return waMessage
    }
},

parseMention: {
         value(text) {
            return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net') || []
         }
      }

})

   return sock
}

exports.Serialize = (sock, msg) => {
  const m = {}
  const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net'
   
      if (!msg.message) return
   if (msg.key && msg.key.remoteJid == "status@broadcast") return 
   
 m.message = extractMessageContent(msg.message)

   if (msg.key) {
      m.key = msg.key
      m.from = m.key.remoteJid
    	m.chat = m.key.remoteJid
      m.fromMe = m.key.fromMe
      m.id = m.key.id
      m.device = getDevice(m.id)
      m.isBaileys = m.id.startsWith("BAE5")
      m.isGroup = m.from.endsWith("@g.us")
      m.participant = !m.isGroup ? false : m.key.participant
      m.sender = m.fromMe ? sock.user.id : m.isGroup ? m.participant : m.from
   }

   m.pushName = msg.pushName
   m.isOwner = m.sender && [...config.owner, botNumber.split`@`[0]].includes(m.sender.replace(/\D+/g, ""))
   if (m.isGroup) {
      m.metadata = sock.groupMetadata(m.from)
   }

   if (m.message) {
      m.type = getContentType(m.message) || Object.keys(m.message)[0]
      m.msg = extractMessageContent(m.message[m.type]) || m.message[m.type]
      m.mentions = m.msg?.contextInfo?.mentionedJid || []
      m.body = m.msg?.text || m.msg?.conversation || m.msg?.caption || m.message?.conversation || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || ""
      m.arg = m.body.trim().split(/ +/).filter(a => a) || []
      m.expiration = m.msg?.contextInfo?.expiration || 0
      m.timestamp = (typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : msg.messageTimestamp.low ? msg.messageTimestamp.low : msg.messageTimestamp.high) || m.msg.timestampMs * 1000
      m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath
      if (m.isMedia) {
         m.mime = m.msg?.mimetype
         m.size = m.msg?.fileLength
         m.height = m.msg?.height || ""
         m.width = m.msg?.width || ""
         if (/webp/i.test(m.mime)) {
            m.isAnimated = m.msg?.isAnimated
         }
      }
      m.reply = async (text, options = {}) => {
         let chatId = options?.from ? options.from : m.from
         let quoted = options?.quoted ? options.quoted : m

         if ((Buffer.isBuffer(text) || /^data:.?\/.*?;base64,/i.test(text) || /^https?:\/\//.test(text) || fs.existsSync(text))) {
            let data = await Function.getFile(text)
            if (!options.mimetype && (/utf-8|json/i.test(data.mime) || data.ext == ".bin" || !data.ext)) {
               if (!!config.msg[text]) text = config.msg[text]
               return sock.sendMessage(chatId, { text, mentions: [m.sender, ...sock.parseMention(text)], ...options }, { quoted, ephemeralExpiration: m.expiration, ...options })
            } else {
               return sock.sendMedia(m.from, data.data, quoted, { ephemeralExpiration: m.expiration, ...options })
            }
         } else {
            if (!!config.msg[text]) text = config.msg[text]
            return sock.sendMessage(chatId, { text, mentions: [m.sender, ...sock.parseMention(text)], ...options, }, { quoted, ephemeralExpiration: m.expiration, ...options });
         }
      }
      m.download = (filepath) => {
         if (filepath) return sock.downloadMediaMessage(m, filepath)
         else return sock.downloadMediaMessage(m)
      }
m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => sock.copyNForward(jid, m, forceForward, options)

   }

   // quoted line
   m.isQuoted = false
   if (m.msg?.contextInfo?.quotedMessage) {
      m.isQuoted = true
      m.quoted = {}
      m.quoted.message = extractMessageContent(m.msg?.contextInfo?.quotedMessage)

      if (m.quoted.message) {
         m.quoted.type = getContentType(m.quoted.message) || Object.keys(m.quoted.message)[0]
         m.quoted.msg = extractMessageContent(m.quoted.message[m.quoted.type]) || m.quoted.message[m.quoted.type]
         m.quoted.key = {
            remoteJid: m.msg?.contextInfo?.remoteJid || m.from,
            participant: m.msg?.contextInfo?.remoteJid?.endsWith("g.us") ? m.msg?.contextInfo?.participant : false,
            fromMe: areJidsSameUser(m.msg?.contextInfo?.participant, sock?.user?.id),
            id: m.msg?.contextInfo?.stanzaId
         }
         m.quoted.from = m.quoted.key.remoteJid
         m.quoted.fromMe = m.quoted.key.fromMe
         m.quoted.id = m.msg?.contextInfo?.stanzaId
         m.quoted.device = getDevice(m.quoted.id)
         m.quoted.isBaileys = m.quoted.id.startsWith("BAE5")
         m.quoted.isGroup = m.quoted.from.endsWith("@g.us")
         m.quoted.participant = m.quoted.key.participant
         m.quoted.sender = m.msg?.contextInfo?.participant

         m.quoted.isOwner = m.quoted.sender && [...config.owner, botNumber.split`@`[0]].includes(m.quoted.sender.replace(/\D+/g, ""))
         if (m.quoted.isGroup) {
            m.quoted.metadata = sock.groupMetadata(m.quoted.from)
         }

         m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || []
         m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ""
         m.quoted.arg = m.quoted.body.trim().split(/ +/).filter(a => a) || []
         m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath
         if (m.quoted.isMedia) {
            m.quoted.mime = m.quoted.msg?.mimetype
            m.quoted.size = m.quoted.msg?.fileLength
            m.quoted.height = m.quoted.msg?.height || ''
            m.quoted.width = m.quoted.msg?.width || ''
            if (/webp/i.test(m.quoted.mime)) {
               m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false
            }
         }
         m.quoted.reply = (text, options = {}) => {
            return m.reply(text, { quoted: m.quoted, ...options })
         }
         m.quoted.download = (filepath) => {
            if (filepath) return sock.downloadMediaMessage(m.quoted, filepath)
            else return sock.downloadMediaMessage(m.quoted)
         }
      }
   }

    return m
}