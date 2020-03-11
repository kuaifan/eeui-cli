var path = require('path');

exports.lib = function (file) {
    return path.resolve(__dirname, file);
};

exports.dep = function (dep) {
    return dep;
};
