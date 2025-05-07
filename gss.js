const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const tokenEnv = true
const TOKEN_FILENAME = 'token.json';
const CREDENTIALS_FILENAME = 'credentials.json';
const TOKEN_PATH = path.join(process.cwd(), TOKEN_FILENAME);
const CREDENTIALS_PATH = path.join(process.cwd(), CREDENTIALS_FILENAME);

class GSS {    
    constructor(ssId, shId) {
        this.ssId = ssId
        this.shId = shId
    }
    async loadSavedCredentialsIfExist() {
        try {
            let content = process.env.TOKEN_JSON
            if(!tokenEnv){
                content = await fs.readFile(TOKEN_PATH);
            }
            const credentials = JSON.parse(content);
            return google.auth.fromJSON(credentials);
        } catch (err) {
            return null;
        }
    }

    async saveCredentials(client) {
        let content = process.env.CREDENTIALS_JSON
        if(!tokenEnv){
            content = await fs.readFile(CREDENTIALS_PATH);
        }
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        });
        await fs.writeFile(TOKEN_PATH, payload);
    }

    async authorize() {
        let client = await this.loadSavedCredentialsIfExist();
        if (client) {
            this.auth = client;
            return;
        }
        client = await authenticate({
            scopes: SCOPES,
            keyfilePath: CREDENTIALS_PATH,
        });
        if (client.credentials) {
            await this.saveCredentials(client);
        }
        this.auth = client;
    }
    async append(values){
        const sheets = google.sheets({version: 'v4', auth: this.auth});
        let res = await sheets.spreadsheets.values.get({
            spreadsheetId: this.ssId,
            range: this.shId + '!A1',
        });
        const OFFSET = 2;
        const rows = res.data.values[0][0];
        res = await sheets.spreadsheets.values.append({
            spreadsheetId: this.ssId,
            range: this.shId + '!A' + (rows*1 + OFFSET),
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[values]]
            },
        });
        return res.data;
    }
}
module.exports = GSS;