require('dotenv').config();
const WWBot = require('./wwbot');
const GSS = require('./gss');
const express = require("express");

const fs = require('fs');
const path = require('path');
const OCR = require('./api_nodejs/ocr');

const BASE_URL = '/wpp'
const OCR_URL = "https://api-nodejs-1cdfy69fn-billygls-projects.vercel.app/ocr"
const localOCR = true

const API_KEYS = [
    {
        customer: 'test',
        credential: 'TEe0LmQK0z'
    }
]
const SS_ID = '1AEjbLYC64LNwW6yDoaicR39ZKU9zrtqT6PIYpUz7UFU'
const SH_ID = '💰pagos'
const GROUP_IDS = [
    //'51997938975-1571774785@g.us', //B & J Home Stats
    '120363374831762604@g.us' //Constancias, pagos y otros comprobantes💰
]

const app = express();

app.use(express.json());
app.use(express.urlencoded());

const gss = new GSS(SS_ID, SH_ID);

app.get(BASE_URL + "/", (req, res) => {
    processImage()
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
    if(localOCR){
        const ocr = new OCR();
        await ocr.init()
        const text = await ocr.processImage(image)
        ocr.finish()
        return text
    }
    const response = await fetch(OCR_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image })
    })
    const json = await response.json()
    if(json && json.text){
        return json.text
    }
    return ""
}
const processPayments = async (msg) => {
    if(!msg){
        return
    }
    const {from, to, author, notifyName, body, caption, type, timestamp} = msg
    if(!GROUP_IDS.includes(from)){
        return
    }
    log(from, to, author, notifyName, body, caption, type, timestamp)
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if(!media){
            return
        }
        const WEP = 'image/webp'
        if(media.mimetype === WEP){
            return
        }
        log(media.filename, media.mimetype)//, media.data
        const data = `data:${media.mimetype};base64,${media.data}`
        const text = await processImage(data)
        saveText(`${author}
${text}
${caption}
${body}
${timestamp}`
        )
        try{
        await msg.react("🔄️")
        }catch(e){}
    }else{
        saveText(`${author}
${body}
${timestamp}`
        )
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
const init = async (customer, res) => {
    log("/init")
    await gss.authorize()

    listener.onQR = (dataURLQR) => {
        log("onQR")
        if(res){
            res.send(`<img src="${dataURLQR}" alt="QR Code"/>`);
        }
    }
    listener.onReady = () => {
        log("onReady")
        if(res){
            res.send({
                status: 'ready'
            });
        }
    }
    const wwbot = new WWBot(customer, listener);
    await wwbot.init(true)
}
app.get(BASE_URL + "/init", async (req, res) => {
    const customer = validate(req, res)
    if(!customer){
        return
    }
    init(customer, res)
});

app.listen(process.env.PORT || 1337, () => {
    console.log("it is running")
    init(API_KEYS[0].customer, null)
});