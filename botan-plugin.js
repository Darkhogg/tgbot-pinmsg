'use strict';
const pd = require('paperdrone');

const botanio = require('botanio');
module.exports = pd.Plugin.define('Botan', function (bot, options) {
    let botan = botanio(options.botan.token);

    bot.on('message', function ($evt, message) {
        botan.track(message);
    });
});
