const fs = require('fs')
const chalk = require('chalk')

global.apikey = "apikey"//setting apikey
global.namabot = 'Bens - MD'//setting bot name
global.owner = ["628871746203"]//settinh owner
global.prefix =   "/^[°•π÷×¶∆£¢€¥®™+✓_=|/~!?@#%^&.©^]/i"
global.pairingNum = ""//contoh: 62xxxx

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.yellow(`'${__filename}' telah di update`))
    delete require.cache[file]
    require(file)
})