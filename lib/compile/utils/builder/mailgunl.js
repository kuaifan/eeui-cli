const mailgun = require("mailgun-js");
const utils = require('../index');

module.exports = {
    send(subject, text, to) {
        let APIKEY = utils.env("MAIL-APIKEY");
        let DOMAIN = utils.env("MAIL-DOMAIN");
        let FROM = utils.env("MAIL-FROM");
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