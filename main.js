const WWBot = require('./wwbot');

const BASE_URL = '/wpp'
const API_KEYS = [
    {
        customer: 'test',
        credential: 'TEe0LmQK0z'
    }
]
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded());

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
const processPayments = async (msg) => {
    const {from, to, author, notifyName, body, caption} = msg
    console.log(from, to, author, notifyName, body, caption)
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        // do something with the media data here
        console.log("----",media.filename, media.mimetype)//, media.data
        try{
            await msg.react("👍") //not working
        }catch(e){
            console.error("error react")
        }
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

app.listen(process.env.PORT || 80, () => console.log("it is running"));