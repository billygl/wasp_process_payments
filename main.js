const WWBot = require('./wwbot');
const GSS = require('./gss');
const express = require("express");
const {createWorker} = require('tesseract.js')
const fs = require('fs');
const path = require('path');

const BASE_URL = '/wpp'
const API_KEYS = [
    {
        customer: 'test',
        credential: 'TEe0LmQK0z'
    }
]
const SS_ID = '1AEjbLYC64LNwW6yDoaicR39ZKU9zrtqT6PIYpUz7UFU'
const SH_ID = 'pagos'
const GROUP_IDS = [
    //'51997938975-1571774785@g.us', //B & J Home Stats
    '120363374831762604@g.us' //Constancias, pagos y otros comprobantes💰
]

const app = express();

app.use(express.json());
app.use(express.urlencoded());

let worker = null;
(async () => {
    worker = await createWorker('spa');
})();
const gss = new GSS(SS_ID, SH_ID);

app.get(BASE_URL + "/", (req, res) => {
    res.send("hello world");
});

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const getLogFileName = () => {
    const date = new Date();
    const day = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(logDir, `${day}.log`);
};

const logStream = () => fs.createWriteStream(getLogFileName(), { flags: 'a' });

const log = (...args) => {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    logStream().write(logMessage);
};
const validate = (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send("Authorization header missing");
        return null
    }

    const [customer, credential] = Buffer.from(authHeader.split(" ")[1], 'base64').toString().split(":");
    const apiKey = API_KEYS.find(key => key.customer === customer && key.credential === credential);

    if (!apiKey) {
        res.status(403).send("Invalid credentials")
        return null
    }
    return customer
}
const saveText = async (text) => {
    gss.append(text)
}
const processImage = async (image) => {
    const ret = await worker.recognize(image);
    return ret.data.text.trim()
}
const processPayments = async (msg) => {
    if(!msg){
        return
    }
    const {from, to, author, notifyName, body, caption, type, timestamp} = msg
    log(from, to, author, notifyName, body, caption, type, timestamp)
    if(!GROUP_IDS.includes(from)){
        return
    }
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if(!media){
            return
        }
        log(media.filename, media.mimetype)//, media.data
        const data = `data:${media.mimetype};base64,${media.data}`
        const text = await processImage(data)
        saveText(`
            ${author}\n\n
            ${text}\n\n
            ${caption}\n
            ${timestamp}
            `
        )
        await msg.react("🔄️")
    }
}
const logReaction = async (_reaction) => {
    const {reaction, id, participant, timestamp} = _reaction
    const {remote} = id
    log(reaction, remote, participant, timestamp)
}
const listener = {
    onMessage: processPayments,
    onReaction: logReaction
}
app.get(BASE_URL + "/init", async (req, res) => {
    const customer = validate(req, res)
    if(!customer){
        return
    }
    log("/init")
    await gss.authorize()

    listener.onQR = (dataURLQR) => {
        log("onQR")
        res.send(`<img src="${dataURLQR}" alt="QR Code"/>`);
    }
    listener.onReady = () => {
        log("onReady")
        res.send({
            status: 'ready'
        });
    }
    const wwbot = new WWBot(customer, listener);
    await wwbot.init(true)
});
app.get(BASE_URL + "/finish", async (req, res) => {
    const customer = validate(req, res)
    if(!customer){
        return
    }
    log("/finish")
    await worker.terminate();
});

app.listen(process.env.PORT || 80, () => console.log("it is running"));