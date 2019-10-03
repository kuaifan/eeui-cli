const fs = require('fs');
const path = require('path');
const parse = require('url').parse;

const utils = {
    isNullOrUndefined(obj) {
        return typeof obj === "undefined" || obj === null;
    },

    isObject(obj) {
        return this.isNullOrUndefined(obj) ? false : typeof obj === "object";
    },

    likeArray(obj) {
        return this.isNullOrUndefined(obj) ? false : typeof obj.length === 'number';
    },

    strExists(string, find, lower) {
        string += "";
        find += "";
        if (lower !== true) {
            string = string.toLowerCase();
            find = find.toLowerCase();
        }
        return (string.indexOf(find) !== -1);
    },

    leftExists(string, find) {
        string += "";
        find += "";
        return (string.substring(0, find.length) === find);
    },

    rightExists(string, find) {
        string += "";
        find += "";
        return (string.substring(string.length - find.length) === find);
    },

    leftDelete(string, find) {
        string += "";
        find += "";
        if (this.leftExists(string, find)) {
            string = string.substring(find.length)
        }
        return string ? string : '';
    },

    rightDelete(string, find) {
        string += "";
        find += "";
        if (this.rightExists(string, find)) {
            string = string.substring(0, string.length - find.length)
        }
        return string ? string : '';
    },

    findIndexOf(str, cha, num) {
        str+= "";
        cha+= "";
        let x = str.indexOf(cha);
        for (let i = 0; i < num; i++) {
            x = str.indexOf(cha, x + 1);
            if (x === -1) {
                break;
            }
        }
        return x;
    },

    clone(myObj) {
        if (typeof(myObj) !== 'object') return myObj;
        if (myObj === null) return myObj;
        //
        if (this.likeArray(myObj)) {
            let [...myNewObj] = myObj;
            return myNewObj;
        } else {
            let {...myNewObj} = myObj;
            return myNewObj;
        }
    },

    count(obj) {
        try {
            if (typeof obj === "undefined") {
                return 0;
            }
            if (typeof obj === "number") {
                obj+= "";
            }
            if (typeof obj.length === 'number') {
                return obj.length;
            } else {
                let i = 0, key;
                for (key in obj) {
                    i++;
                }
                return i;
            }
        }catch (e) {
            return 0;
        }
    },

    each(elements, callback) {
        let i, key;
        if (this.likeArray(elements)) {
            if (typeof elements.length === "number") {
                for (i = 0; i < elements.length; i++) {
                    if (callback.call(elements[i], i, elements[i]) === false) return elements
                }
            }
        } else {
            for (key in elements) {
                if (!elements.hasOwnProperty(key)) continue;
                if (callback.call(elements[key], key, elements[key]) === false) return elements
            }
        }

        return elements
    },

    getObject(obj, keys) {
        let object = obj;
        if (this.count(obj) === 0 || this.count(keys) === 0) {
            return "";
        }
        let arr = keys.replace(/,/g, "|").replace(/\./g, "|").split("|");
        this.each(arr, (index, key) => {
            object = typeof object[key] === "undefined" ? "" : object[key];
        });
        return object;
    },

    jsonParse(str, defaultVal) {
        try{
            return JSON.parse(str);
        }catch (e) {
            return defaultVal ? defaultVal : {};
        }
    },

    jsonStringify(json, defaultVal) {
        try{
            return JSON.stringify(json);
        }catch (e) {
            return defaultVal ? defaultVal : "";
        }
    },

    randomString(len) {
        len = len || 32;
        let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678oOLl9gqVvUuI1';
        let maxPos = $chars.length;
        let pwd = '';
        for (let i = 0; i < len; i++) {
            pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd;
    },

    runNum(str, fixed) {
        let _s = Number(str);
        if (_s + "" === "NaN") {
            _s = 0;
        }
        if (/^[0-9]*[1-9][0-9]*$/.test(fixed)) {
            _s = _s.toFixed(fixed);
            let rs = _s.indexOf('.');
            if (rs < 0) {
                _s += ".";
                for (let i = 0; i < fixed; i++) {
                    _s += "0";
                }
            }
        }
        return _s;
    },

    zeroFill(str, length, after) {
        str += "";
        if (str.length >= length) {
            return str;
        }
        let _str = '', _ret = '';
        for (let i = 0; i < length; i++) {
            _str += '0';
        }
        if (after || typeof after === 'undefined') {
            _ret = (_str + "" + str).substr(length * -1);
        } else {
            _ret = (str + "" + _str).substr(0, length);
        }
        return _ret;
    },

    timestamp() {
        return Math.round(new Date().getTime() / 1000);
    },

    formatDate(format, v) {
        if (format === '') {
            format = 'Y-m-d H:i:s';
        }
        if (typeof v === 'undefined') {
            v = new Date().getTime();
        } else if (/^(-)?\d{1,10}$/.test(v)) {
            v = v * 1000;
        } else if (/^(-)?\d{1,13}$/.test(v)) {
            v = v * 1000;
        } else if (/^(-)?\d{1,14}$/.test(v)) {
            v = v * 100;
        } else if (/^(-)?\d{1,15}$/.test(v)) {
            v = v * 10;
        } else if (/^(-)?\d{1,16}$/.test(v)) {
            v = v * 1;
        } else {
            return v;
        }
        let dateObj = new Date(v);
        if (parseInt(dateObj.getFullYear()) + "" === "NaN") {
            return v;
        }
        //
        format = format.replace(/Y/g, dateObj.getFullYear());
        format = format.replace(/m/g, this.zeroFill(dateObj.getMonth() + 1, 2));
        format = format.replace(/d/g, this.zeroFill(dateObj.getDate(), 2));
        format = format.replace(/H/g, this.zeroFill(dateObj.getHours(), 2));
        format = format.replace(/i/g, this.zeroFill(dateObj.getMinutes(), 2));
        format = format.replace(/s/g, this.zeroFill(dateObj.getSeconds(), 2));
        return format;
    },

    parseURL(url) {
        let a = parse(url);
        return {
            source: url,
            protocol: (a.protocol || "").replace(':', ''),
            host: a.hostname || "",
            port: a.port || "",
            query: decodeURIComponent(a.search || ""),
            params: (function () {
                let params = {},
                    seg = (a.search || "").replace(/^\?/, '').split('&'),
                    len = seg.length,
                    p;
                for (let i = 0; i < len; i++) {
                    if (seg[i]) {
                        p = seg[i].split('=');
                        params[p[0]] = decodeURIComponent(p[1]);
                    }
                }
                return params;
            })(),
            hash: (a.hash || "").replace('#', ''),
            path: (a.pathname || "").replace(/^([^\/])/, '/$1')
        };
    },

    env(key) {
        let file = path.join(__dirname, '../.env');
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
    }
};

module.exports = utils;