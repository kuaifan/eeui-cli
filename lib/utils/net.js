function post(url, param, header, callback) {
    let request = require('request');
    header['Content-Type'] = 'application/x-www-form-urlencoded';
    let options = {
        method: 'post',
        url: url,
        form: param,
        headers: header
    };

    request(options, function (err, res, body) {
        if (err) {
            callback(err)
        } else {
            callback(body)
        }
    })
}

module.exports = {post};