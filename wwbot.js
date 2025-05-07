const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WWBot {    
    constructor(name, listener) {
        this.name = name;
        this.listener = listener;
        this.data = 'data/' + name
    }
    async init(toListener) {
        return new Promise((resolve) => {
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: this.data
                })
            });
            this.client.on('qr', async (qr) => {
                const data = await QRCode.toDataURL(qr)
                this.listener.onQR(data)
                resolve()
            })
            this.client.on('ready', () => {
                if(toListener){
                    this.listener.onReady()
                }
                resolve()
            });            
            this.client.on('message', msg => {
                this.listener.onMessage(msg)
            });
            this.client.on('message_reaction', reaction => {
                this.listener.onReaction(reaction)
            });
            this.client.initialize()
        })
    }
    sendMessage(phone, message) {
        console.log("send to " + phone_wasp, message);
        return this.send(phone, message)
    }
    logSend(phone, message){
        const timestamp = new Date().toISOString();
        const logEntry = `${phone},${timestamp},${message}\n`;
        const logFilePath = path.join(__dirname, this.data, 'log.csv');

        fs.appendFile(logFilePath, logEntry, (err) => {
            if (err) {
                console.error('Failed to write to log file:', err);
            } else {
                console.log('Message logged');
            }
        });
    }
    send(phone, message){
        logSend(phone, message)
        let phone_wasp = phone + '@c.us'
        return this.client.sendMessage(phone_wasp, message)
        
    }
}

module.exports = WWBot;