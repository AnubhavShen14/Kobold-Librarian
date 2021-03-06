/*
 * greetings.js: Personalized greetings.
 */

const config = require('../config');
const quills = require('../quills');
const server = require('../server');
const storage = require('../storage');
const utils = require('../utils');

quills.addShopItem('greeting', "Personalized Greeting", 1000, `Each time you join a room with ${config.username} in it, it will send you a personalized greeting of your choice. This greeting can be set or changed at any time using <code>${config.commandToken}setgreeting message</code>. Staff have the right to revoke this purchase if the greeting is misused or abused.`, null, true);

const cooldowns = new Map();

module.exports = {
	async onJoin(userid, roomid) {
		if (cooldowns.has(userid)) return;
		if (storage.getJSON('greetings')[userid]) {
			cooldowns.set(userid, setTimeout(() => cooldowns.delete(userid), 60 * 60 * 1000))
			this.send(roomid, `(${userid}) ${storage.getJSON('greetings')[userid]}`);
		}
	},
	commands: {
		async setgreeting(userid, roomid, message) {
			if (!quills.getAccount(userid).inventory.greeting) return this.sendPM(userid, `In order to set a personal greeting, you need to purchase it in the [[Scribe Shop <${server.url}shop.html>]].`);
			message = message.trim();
			if (!message) return this.sendPM(userid, `Syntax: \`\`${config.commandToken}setgreeting message\`\``);
			if (message.length > 80) return this.sendPM(`Greetings cannot exceed 80 characters.`);

			storage.getJSON('greetings')[userid] = message;
			storage.exportJSON('greetings');
			return this.sendPM(userid, `Greeting set to: "(${userid}) ${message}"`);
		},
		async deletegreeting(userid, roomid, message) {
			if (!this.hasPerms('%')) return this.send(`Permission denied.`);
			message = utils.toId(message);
			if (!(quills.getAccount(message).inventory.greeting && storage.getJSON('greetings')[message])) return this.send(`This user does not have a greeting set.`);

			delete storage.getJSON('greetings')[message];
			quills.useItem(message, 'greeting');
			storage.exportJSON('greetings');
			this.send(`/modnote ${message} had their greeting forcibly removed.`);
			return this.send(`Greeting removed.`);
		},
	},
};
