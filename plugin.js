'use strict';
const pd = require('paperdrone');

const BotanPlugin = require('./botan-plugin');

module.exports = pd.Plugin.define('~PinMsg', function (bot, options) {
    /* Add our required plugins */
    bot.addPlugin(new pd.plugins.HelpPlugin());
    bot.addPlugin(new pd.plugins.MessagesPlugin());
    bot.addPlugin(new pd.plugins.CommandsPlugin());
    bot.addPlugin(new pd.plugins.PrompterPlugin());
    bot.addPlugin(new pd.plugins.KeyedStoragePlugin());

    bot.addPlugin(new BotanPlugin());

    /* Set up the help */
    bot.help.commands = ['help', 'start'];
    bot.help.text = 'Add me to any group to allow message pinning.\n\n' +
        'Commands:\n' +
        '/pin – Set a new pinned message.\n' +//There are multiple ways of pinning a message:\n' +
        //' \u{2022} Send this command, then write the message as instructed.\n' +
        //' \u{2022} Send this command and message on the same text.\n' +
        //' \u{2022} Reply to any message with this command to pin that message.\n' +
        '/pinned – Send the current pinned message to the group.\n' +
        '/unpin – Remove the current message.\n\n' +
        'If you find me useful, give me a good rating [on the @StoreBot](https://telegram.me/storebot?start=pinmsgbot)!\n' +
        'I\'m an open source bot, you can [check me out on Github](https://github.com/Darkhogg/tgbot-pinmsg)!\n';

    /* Do not respond to commands outside of groups */
    bot.on('command', function ($evt, cmd, msg) {
        if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
            $evt.stop();

            return new pd.API.Request('sendMessage', {
                'chat_id': msg.chat.id,
                'text': 'Add me to a group to be able to pin messages!  ' +
                    'I\'m of no use on private chats.\n' +
                    'See /help for more information.'
            });
        }
    });

    /* Define the actual pinning/unpinning/retrieving functions */
    bot.pinMessage = function pinMessage (chatId, messageId) {
        bot.logger.info('[~PinMsg]  pinning message "%s" to chat "%s"', messageId, chatId);
        return bot.storage.set('pin', chatId, { 'message_id': messageId })
            .then(() => new pd.API.Request('sendMessage', {
                'chat_id': chatId,
                'text': 'Message successfully pinned! Retrieve at any time with /pinned or unpin it with /unpin.',
            }));
    };

    bot.unpinMessage = function unpinMessage (chatId) {
        bot.logger.info('[~PinMsg]  unpinning message from chat "%s"', chatId);
        return bot.storage.del('pin', chatId).then((rr) => rr.result.n > 0);
    };

    bot.getPinnedMessage = function getPinnedMessage (chatId) {
        bot.logger.verbose('[~PinMsg]  obtaining pinned message from chat "%s"', chatId);
        return bot.storage.get('pin', chatId).then((obj) => obj.message_id || null);
    };

    /* Pin command */
    bot.on('command.pin', function ($evt, cmd, msg) {
        /* If this is a reply to some message, then that's the pinned message! */
        if (msg.reply_to_message) {
            return bot.pinMessage(msg.chat.id, msg.reply_to_message.message_id);
        }

        /* Else, start the prompt */
        return bot.prompter.prompt(msg.chat.id, msg.from.id, 'pin', { 'message_id': msg.message_id });
    });

    /* Unpin command */
    bot.on('command.unpin', function ($evt, cmd, msg) {
        return bot.unpinMessage(msg.chat.id).then((unpinned) => {
            let text = unpinned
                ? 'Message successfully unpinned!'
                : 'There was no message to unpin.';

            return new pd.API.Request('sendMessage', {
                'chat_id': msg.chat.id,
                'text': text
            });
        });
    });

    /* Pinned command */
    bot.on('command.pinned', function ($evt, cmd, msg) {
        return bot.getPinnedMessage(msg.chat.id).then((pinnedMsg) => {
            /* Inform if no pinned message is available */
            if (!pinnedMsg) {
                return new pd.API.Request('sendMessage', {
                    'chat_id': msg.chat.id,
                    'text': 'This group doesn\'t have a pinned message. Use /pin to add one!'
                });
            }

            /* Forward the pinned message */
            return new pd.API.Request('forwardMessage', {
                'chat_id': msg.chat.id,
                'from_chat_id': msg.chat.id,
                'message_id': pinnedMsg
            });
        });
    });

    /* Prompt for pinned message */
    bot.on('prompt.request.pin', function ($evt, prompt) {
        return new pd.API.Request('sendMessage', {
            'chat_id': prompt.chat,
            'reply_to_message_id': prompt.data.message_id,
            'text': 'Write a message to be pinned.\n' +
                //'If you want to'
                'You may also /cancel this action.\n',
            'reply_markup': JSON.stringify({
                'force_reply': true,
                'selective': true
            })
        });
    });

    bot.on('prompt.complete.pin', function ($evt, prompt, result) {
        if (result.text && result.text.trim().indexOf('/cancel') == 0) {
            return new pd.API.Request('sendMessage', {
                'chat_id': result.chat.id,
                'text': 'Ok, I won\'t modify the pinned message.'
            });
        }

        let pinMsgId = result.message_id;
        return bot.pinMessage(result.chat.id, pinMsgId);
    });
});
