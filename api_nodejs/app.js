const express = require("express");
const OCR = require("./ocr");
const app = express();

app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.send("Express on Vercel"));
app.post("/ocr", async (req, res) => {
    if(!req.body.image){
        res.status(400).send("Missing image parameter")
        return
    }
    const ocr = new OCR();
    await ocr.init()
    const text = await ocr.processImage(req.body.image)
    ocr.finish()
    res.send({
        text
    })
})

app.listen(3000, () => console.log("Server ready on port 3000."));

module.exports = app;