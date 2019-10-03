const path = require('path');
const notifier = require('node-notifier');

notifier.notify({
    title: 'EEUI',
    message: "Build successful",
    contentImage: path.join(__dirname, 'logo.png')
});

process.exit();
