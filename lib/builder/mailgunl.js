const fs = require("fs");
const path = require("path");
const mailgun = require("mailgun-js");
const utils = require('../utils');

module.exports = {
    env(key) {
        let file = path.join(__dirname, '../compile/.env');
        if (!fs.existsSync(file)) {
            return null;
        }
        let content = fs.readFileSync(file) + "\n";
        let regExp = new RegExp(key + "\\s*=\\s*(.*?)\\n", "g");
        if (!content.match(regExp)) {
            return null;
        }
        let value = regExp.exec(content)[1];
        return value ? value.trim() : null;
    },

    send(subject, text, to) {
        let APIKEY = this.env("MAIL-APIKEY");
        let DOMAIN = this.env("MAIL-DOMAIN");
        let FROM = this.env("MAIL-FROM");
        if (utils.isNullOrUndefined(APIKEY) || utils.isNullOrUndefined(DOMAIN) || utils.isNullOrUndefined(FROM)) {
            return;
        }
        //
        let MG = mailgun({apiKey: APIKEY, domain: DOMAIN});
        MG.messages().send({
            from: FROM,
            to: to,
            subject: subject,
            text: text
        }, function (error, body) {
            console.log(body);
        });
    }
};