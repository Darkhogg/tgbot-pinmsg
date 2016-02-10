#!/usr/bin/env node
'use strict';
const crashit = require('crashit');
const crypto = require('crypto')
const mongodb = require('mongodb-bluebird');
const pd = require('paperdrone');
const restify = require('restify');

const PinMsgPlugin = require('./plugin');

const log = require('./log');

/* == WEB APP == */
let server = restify.createServer();
server.use(restify.bodyParser())
server.on('NotFound', function (req, res, err, next) {
    res.status(418);
    res.end();
    next();
});

/* == TELEGRAM BOT == */
mongodb.connect(process.env.MONGO_URL).then((db) => {
    let bot = new pd.Bot({
        'token': process.env.TGBOT_TOKEN,
        'mongo': {
            'client': db
        },
        'botan': {
            'token': process.env.BOTAN_TOKEN
        }
    });

    bot.addPlugin(new PinMsgPlugin());

    bot.setupTickLoop(parseInt(process.env.TGBOT_TICK_INTERVAL) || 60);

    if (process.env.TGBOT_WEBHOOK_ENABLE) {
        let hook = bot.getWebhook();

        let hash = crypto.createHash('sha256');
        hash.update(bot.api.token);

        let hookPath = process.env.TGBOT_WEBHOOK_PATH + hash.digest('hex');

        server.post(hookPath, hook);
        bot.api.setWebhook({'url': process.env.TGBOT_WEBHOOK_PREFIX + hookPath});
    } else {
        bot.setupPollLoop();
    }

    /* == WEB SERVER == */
    server.listen(process.env.PORT, () => {
      log.verbose('[Server]  server listening:', server.url);
    });
});

/* == CRASHIT == */
crashit.addHook((cause) => {
    log.warn('[App]  shutting down: %s', cause);
});

crashit.handleSignals(['SIGINT', 'SIGTERM', 'SIGUSR2'], true)
crashit.handleUncaught(true);

process.on('unhandledRejection', (err) => {
    console.error(err.stack);
    crashit.crash(err, true);
});
