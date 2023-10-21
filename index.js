const { Boom } = require('@hapi/boom')
const NodeCache = require('node-cache')
const readline = require('readline')
const { makeWASocket, AnyMessageContent, delay, DisconnectReason, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, makeCacheableSignalKeyStore, makeInMemoryStore, PHONENUMBER_MCC, proto, useMultiFileAuthState, WAMessageContent, WAMessageKey } = require('@whiskeysockets/baileys')
const open = require('open')
const fs = require('fs')
const Pino = require('pino')
const chalk = require('chalk')
const { parsePhoneNumber } = require("libphonenumber-js")
const config = require("./config.js")
const { Client, Serialize } = require("./lib/serialize.js")

const logger = Pino({ level: "fatal" }).child({ level: "fatal" })

function nocache(module, cb = () => { }) {
	console.log(`${module} menunggu informasi..`) 
	fs.watchFile(require.resolve(module), async () => {
		await uncache(require.resolve(module))
		cb(module)
	})
}

function uncache(module = '.') {
	return new Promise((resolve, reject) => {
		try {
			delete require.cache[require.resolve(module)]
			resolve()
		} catch (e) {
			reject(e)
		}
	})
}

const usePairingCode = !!config.pairingNum || process.argv.includes('--use-pairing-code')
const useMobile = process.argv.includes('--mobile')

const store = makeInMemoryStore({ logger: Pino({ level: "fatal" }).child({ level: "fatal" }) })

setInterval(() => {
	store.writeToFile('./bjir_deck.json')
}, 30000)

//membaca line
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

// memulai koneksi
const startSock = async() => {
	const { state, saveCreds } = await useMultiFileAuthState('./bjir_deck')
	const msgRetryCounterCache = new NodeCache()

	const sock = makeWASocket({
	  logger: Pino({ level: "fatal" }).child({ level: "fatal" }), 
	  printQRInTerminal: !usePairingCode,
      mobile: useMobile,
      auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
      },
      browser: ['Chrome (Linux)', '', ''],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
         let jid = jidNormalizedUser(key.remoteJid)
         let msg = await store.loadMessage(jid, key.id)
         return msg?.message || ""
      },
      msgRetryCounterCache, 
      defaultQueryTimeoutMs: undefined,
	})

	store.bind(sock.ev)
	

   await Client({ sock, store })
	
	// konek menggunakan pairing code
	if (usePairingCode && !sock.authState.creds.registered) {
      if (useMobile) throw new Error('Cannot use pairing code with mobile api')
	
let phoneNumber
      if (!!config.pairingNum) {
         phoneNumber = config.pairingNum.replace(/[^0-9]/g, '')

         if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log(chalk.bgBlack(chalk.redBright("Start with your country's WhatsApp code, Example : 62xxx")))
            process.exit(0)
         }
      } else {
         phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number : `)))
         phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

         // Ask again when entering the wrong number
         if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log(chalk.bgBlack(chalk.redBright("Start with your country's WhatsApp code, Example : 62xxx")))

            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number : `)))
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
            rl.close()
         }
      }

      setTimeout(async () => {
         let code = await sock.requestPairingCode(phoneNumber)
         code = code?.match(/.{1,4}/g)?.join("-") || code
         console.log(chalk.black(chalk.bgBlue(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
      }, 3000)
   }
		

	// mobile koneksi
	if(useMobile && !sock.authState.creds.registered) {
		const { registration } = sock.authState.creds || { registration: {} }

		if(!registration.phoneNumber) {
			         let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number : `)))
         phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
		
		if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log(chalk.bgBlack(chalk.redBright("Start with your country's WhatsApp code, Example : 62xxx")))

            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number : `)))
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
         }

         registration.phoneNumber = "+" + phoneNumber
      }

		const phoneNumber = parsePhoneNumber(registration.phoneNumber)
		if(!phoneNumber?.isValid()) {
			throw new Error('Invalid phone number: ' + registration.phoneNumber)
		}

		registration.phoneNumber = phoneNumber.format('E.164')
		registration.phoneNumberCountryCode = phoneNumber.countryCallingCode
		registration.phoneNumberNationalNumber = phoneNumber.nationalNumber
		const mcc = PHONENUMBER_MCC[phoneNumber.countryCallingCode]
		registration.phoneNumberMobileCountryCode = mcc

		async function enterCode() {
			try {
				const code = await question('Please enter the one time code:\n')
				const response = await sock.register(code.replace(/["']/g, '').trim().toLowerCase())
				console.log('Successfully registered your phone number.')
				console.log(response)
				rl.close()
			} catch(error) {
				console.error('Failed to register your phone number. Please try again.\n', error)
				await askForOTP()
			}
		}

		async function enterCaptcha() {
			const response = await sock.requestRegistrationCode({ ...registration, method: 'captcha' })
			const path = __dirname + '/captcha.png'
			fs.writeFileSync(path, Buffer.from(response.image_blob, 'base64'))

			open(path)
			const code = await question('Please enter the captcha code:\n')
			fs.unlinkSync(path)
			registration.captcha = code.replace(/["']/g, '').trim().toLowerCase()
		}
async function askOTP() {
         if (!registration.method) {
            let code = await question(chalk.bgBlack(chalk.greenBright('What method do you want to use? "sms" or "voice" : ')))
            code = code.replace(/["']/g, '').trim().toLowerCase()

            if (code !== 'sms' && code !== 'voice') return await askOTP()

            registration.method = code
         }

         try {
            await sock.requestRegistrationCode(registration)
            await enterCode()
         } catch (e) {
            console.error('Failed to request registration code. Please try again.\n', e)
            if (e?.reason === 'code_checkpoint') {
               await enterCaptcha()
            }
            await askOTP()
         }
      }

      await askOTP()
   }
   
   // write session
   sock.ev.on("creds.update", saveCreds)
   
   //update no restart
   nocache('./message/mess', module => console.log(chalk.greenBright('[ WHATSAPP BOT ]  ') + chalk.cyanBright(` "${module}" Telah diupdate!`)))
   nocache('./lib/serialize', module => console.log(chalk.greenBright('[ WHATSAPP BOT ]  ') + chalk.cyanBright(` "${module}" Telah diupdate!`)))
   
  sock.multi = true
	sock.nopref = false
	sock.prefa = 'anjing'
      sock.ev.on("messages.upsert", async (message) => {
      if (!message.messages) return
      const m = await Serialize(sock, message.messages[0])
      await (await import(`./message/mess.js?v=${Date.now()}`)).default(sock, m, store, message)
   })
   
       sock.ev.on("connection.update", async (update) => {
      const { lastDisconnect, connection, qr } = update
      if (connection) {
         console.info(`Connection Status : ${connection}`)
      }

      if (connection === "close") {
         let reason = new Boom(lastDisconnect?.error)?.output.statusCode
   if (reason === DisconnectReason.connectionClosed) {
            console.log("Connection closed, reconnecting....")
            await startSock()
         } else if (reason === DisconnectReason.connectionLost) {
            console.log("Connection Lost from Server, reconnecting...")
            await startSock()
         } else if (reason === DisconnectReason.restartRequired) {
            console.log("Restart Required, Restarting...")
            await startSock()
         } 
      }
   })

    return sock
  }

startSock()