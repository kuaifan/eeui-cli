const fs = require('fs');
const utils = require("./index");

module.exports = {
    androidGradle(name, newValue) {
        let file = process.cwd() + '/platforms/android/eeuiApp/build.gradle';
        if (!fs.existsSync(file)) {
            return "";
        }
        //
        let value = "";
        let result = fs.readFileSync(file, 'utf8');
        let reg = new RegExp(`${name}\\s*=\\s*("*|'*)(.+?)\\1\\n`);
        let match = result.match(reg);
        if (utils.count(match) > 2) {
            value = match[2].trim();
            if (typeof newValue !== "undefined") {
                let newResult = result.replace(new RegExp(match[0], "g"), `${name} = ${match[1]}${newValue}${match[1]}\n`);
                fs.writeFileSync(file, newResult, 'utf8');
                value = newValue;
            }
        }
        return value;
    },

    iosInfo(name, newValue) {
        let file = process.cwd() + '/platforms/ios/eeuiApp/eeuiApp/Info.plist';
        if (!fs.existsSync(file)) return "";
        //
        let value = "";
        let result = fs.readFileSync(file, 'utf8');
        let reg = new RegExp(`<key>${name}</key>(\\s*\\n*\\s*)<string>(.+?)</string>`);
        let match = result.match(reg);
        if (utils.count(match) > 2) {
            value = match[2].trim();
            if (typeof newValue !== "undefined") {
                let newResult = result.replace(new RegExp(match[0], "g"), `<key>${name}</key>${match[1]}<string>${newValue}</string>`);
                fs.writeFileSync(file, newResult, 'utf8');
                value = newValue;
            }
        }
        return value;
    }
};
