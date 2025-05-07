const WWBot = require('./wwbot');
const GSS = require('./gss');
const express = require("express");
const {createWorker} = require('tesseract.js')

const BASE_URL = '/wpp'
const API_KEYS = [
    {
        customer: 'test',
        credential: 'TEe0LmQK0z'
    }
]
const SS_ID = '1AEjbLYC64LNwW6yDoaicR39ZKU9zrtqT6PIYpUz7UFU'
const SH_ID = 'pagos'

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
function validate(req, res) {
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
    console.log(ret.data.text);
    saveText(ret.data.text)
}
const processPayments = async (msg) => {
    if(!msg){
        return
    }
    const {from, to, author, notifyName, body, caption, type, timestamp} = msg
    console.log(from, to, author, notifyName, body, caption, type, timestamp)
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if(!media){
            return
        }
        console.log("----",media.filename, media.mimetype)//, media.data
        const data = `data:${media.mimetype};base64,${media.data}`
        await processImage(data)
        await msg.react("🔄️")
    }
}
const listener = {
    onMessage: processPayments
}
app.get(BASE_URL + "/init", async (req, res) => {
    const customer = validate(req, res)
    if(!customer){
        return
    }
    console.log("/init")
    await gss.authorize()

    listener.onQR = (dataURLQR) => {
        console.log("onQR")
        res.send(`<img src="${dataURLQR}" alt="QR Code"/>`);
    }
    listener.onReady = () => {
        console.log("onReady")
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
    console.log("/finish")
    await worker.terminate();
});

app.listen(process.env.PORT || 80, () => console.log("it is running"));