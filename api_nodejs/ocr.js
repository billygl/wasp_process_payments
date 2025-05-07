const {createWorker} = require('tesseract.js')

class OCR {
    async init(){
        this.worker = await createWorker('spa');
    }
    async processImage (image) {
        const ret = await this.worker.recognize(image);
        return ret.data.text.trim()
    }
    async finish() {
        await this.worker.terminate();
    }
}
module.exports = OCR;