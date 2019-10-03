const utils = require('../utils');

const ansiHTML = require('ansi-html');

const _require = require('html-entities'),
    AllHtmlEntities = _require.AllHtmlEntities;

const entities = new AllHtmlEntities();
const colors = {
    reset: ['transparent', 'transparent'],
    black: '181818',
    red: 'E36049',
    green: 'B3CB74',
    yellow: 'FFD080',
    blue: '7CAFC2',
    magenta: '7FACCA',
    cyan: 'C3C2EF',
    lightgrey: 'EBE7E3',
    darkgrey: '6D7891'
};
ansiHTML.setColors(colors);

const toHtml = (log) => {
    let tempHtml = "<span style=\"color: #".concat(colors.red, "\">Failed to compile.</span><br/><br/>");
    utils.each(typeof log == 'object' ? log : [log], (index, item) => {
        tempHtml = tempHtml.concat(ansiHTML(entities.encode(item)))
    });
    tempHtml = tempHtml.replace(new RegExp("BabelLoaderError: SyntaxError((?:.|\\n)*?)</span>\\n\\n"), "");
    return tempHtml;
};

module.exports = {
    toHtml,
};