const runAndroid = require('./android');
const runIOS = require('./ios');

module.exports = {
    runAndroid: runAndroid.runAndroid,
    runIOS: runIOS.runIOS
};

