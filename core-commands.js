/*
 * core-commands.js: Core bot commands
 *
 * This file contains all the basic commands every version of this bot should include. This includes administrative commands, help commands and core functionalities.
 */

const config = require('./config');
const quills = require('./quills');
const server = require('./server');
const utils = require('./utils');

const packageInfo = require('./package.json');

server.addRoute(`/console.html`, () => ['Console output', `<code>${utils.stdout}</code>`], {permission: 'console'});

module.exports = {
	aliases: {
		js: 'eval',
		help: 'guide',
		restart: 'kill',

		atm: 'balance',
		bal: 'balance',
		quills: 'balance',

		games: 'game',
		start: 'managegame',
		end: 'managegame',
	},
	commands: {
		// Based on the eval function in Kid A.
		async eval(userid, roomid, message) {
			if (!config.owners.includes(userid)) return this.send(`You need to be listed as a bot owner to use this command.`);
			if (/require\(.+?\)/.test(message)) return this.send("You are not allowed to use ``require()`` when using eval.");

			let ret;
			try {
				ret = JSON.stringify(eval(message));
				if (ret === undefined) return;
			} catch (e) {
				ret = `Failed to eval \`\`${message}\`\`: ${e.toString()}`;
			}
			return this.send(ret);
		},

		async console(userid, roomid) {
			if (!config.owners.includes(userid)) return this.send(`You need to be listed as a bot owner to use this command.`);

			return this.sendPM(userid, `Console output: ${server.url}console.html?token=${server.createAccessToken('console', roomid, userid)}`);
		},

		async kill(userid) {
			if (!config.owners.includes(userid)) return this.send(`You need to be listed as a bot owner to use this command.`);

			utils.errorMsg(`Received '${config.commandToken}kill' by ${userid}.`);
			process.exit(0);
		},

		async update(userid) {
			if (!config.owners.includes(userid)) return this.send(`You need to be listed as a bot owner to use this command.`);

			utils.statusMsg(`Received '${config.commandToken}update' by ${userid}.`);
			require('child_process').exec(`git pull --rebase origin master`, error => {
				if (error) {
					error = String(error).trim().replace(/\n/g, ' | ');
					this.sendPM(userid, error);
					utils.statusMsg(error);
				} else {
					this.sendPM(userid, `Update complete.`);
				}
			});
		},

		async git(userid) {
			let message = `[[Github repository for this bot <${packageInfo.repository.url}>]]`;
			if (!this.hasPerms('+')) return this.sendPM(userid, message);

			return this.send(message);
		},

		async owners(userid) {
			let message = `The owners of this bot are: ${config.owners.join(', ')}.`;
			if (!this.hasPerms('+')) return this.sendPM(userid, message);

			return this.send(message);
		},

		async guide(userid) {
			let message = `[[Guide to using Kobold Librarian <${server.url}guide.html>]]`;
			if (!this.hasPerms('+')) return this.sendPM(userid, message);

			return this.send(message);
		},

		// Quills commands

		async shop(userid, roomid) {
			let message = `Here is the Scribe Shop: ${server.url}shop.html${!roomid ? `?token=${server.createAccessToken('shop', roomid, userid)}` : ''}`;
			if (!this.hasPerms('+')) return this.sendPM(userid, message);

			return this.send(message);
		},
		async addquills(userid, roomid, message) {
			if (!this.hasPerms('%')) return this.sendPM(userid, `Permission denied.`);
			let [target, amount] = message.split(',');
			target = utils.toId(target);
			amount = parseInt(amount);
			if (!target || !amount || isNaN(amount)) return this.send(`Syntax: \`\`${config.commandToken}addquills username, amount\`\``);
			if (amount <= 0) return this.send(`Please enter a number greater than 0.`);

			let newBalance = quills.addQuills(target, amount);
			this.sendPM(userid, `Quills successfully added to the account of ${target}.`);
			this.sendPM(target, `${amount} quill${utils.plural(amount)} have been added to your account. You now have ${newBalance} quill${utils.plural(newBalance)}.`);
		},
		async removequills(userid, roomid, message) {
			if (!this.hasPerms('%')) return this.sendPM(userid, `Permission denied.`);
			let [target, amount] = message.split(',');
			target = utils.toId(target);
			amount = parseInt(amount);
			if (!target || !amount || isNaN(amount)) return this.send(`Syntax: \`\`${config.commandToken}removequills username, amount\`\``);
			if (amount <= 0) return this.send(`Please enter a number greater than 0.`);

			let newBalance = quills.removeQuills(target, amount);
			this.sendPM(userid, `Quills successfully removed from the account of ${target}.`);
			this.sendPM(target, `${amount} quill${utils.plural(amount)} have been removed from your account. You now have ${newBalance} quill${utils.plural(newBalance)}.`);
		},
		async balance(userid, roomid, message) {
			message = utils.toId(message) || userid;
			let self = message === userid;
			let amount = quills.getAccount(message).balance;

			let ret = `${self ? "You" : message} currently ${self ? "have" : "has"} ${amount} quill${utils.plural(amount)}.`;

			if (!(roomid && this.hasPerms('+'))) return this.sendPM(userid, ret);

			return this.send(ret);
		},
		async useitem(userid, roomid, message) {
			if (!this.hasPerms('%')) return this.sendPM(userid, `Permission denied.`);
			let [target, itemId] = message.split(',').map(param => utils.toId(param));
			if (!target || !itemId) return this.send('Syntax: ``.useitem username, item``');

			let itemData = quills.shop.get(itemId);
			if (!itemData) return this.send(`Invalid shop item: ${itemId}`);

			const res = quills.useItem(target, itemId);
			if (res < 0) return this.sendPM(userid, `User ${target} has no ${itemData.name}.`);
			this.send(`${itemData.name} used on the account of ${target}.${res ? ` Uses remaining: ${res}` : ''}`);
			this.sendPM(target, `You have used your ${itemData.name}.${res ? ` Uses remaining: ${res}` : ''}`);
		},
		async giveitem(userid, roomid, message) {
			if (!this.hasPerms('%')) return this.sendPM(userid, `Permission denied.`);
			let [target, itemId] = message.split(',');
			let target = utils.toID(target);
			
			let itemData = quills.shop.get(itemId);
			if (!itemData) return this.send(`Invalid shop item: ${itemId}`);
			
			this.send(quills.giveItem(target, itemId));
		},

		// Game commands

		async game(userid, roomid, message) {
			if (!roomid) return this.sendPM(userid, "You can't use this command in PMs.");
			if (!this.hasPerms('+')) return this.sendPM(userid, "Permission denied.");
			if (!message) return this.send(`List of all games: ${[...this.gameClasses.keys()].join(', ')}`);
			this.newGame(roomid, message, {host: userid});
		},
		async managegame(userid, roomid) {
			if (this.command === 'managegame') return;
			if (!roomid) return this.sendPM(userid, "You can't use this command in PMs.");
			if (!this.gameRooms[roomid]) return this.send(`There isn't an active game to ${this.command}.`);
			if (this.command === 'end') {
				this.gameRooms[roomid].end(true);
				delete this.gameRooms[roomid];
			} else {
				this.gameRooms[roomid][this.command]();
			}
		},
		async host(userid, roomid, message) {
			if (!roomid) return this.sendPM(userid, "You can't use this command in PMs.");
			let game = this.gameRooms[roomid];
			if (!game) return this.send(`There isn't an active game.`);
			message = utils.toId(message);
			if (!message) return this.sendPM(userid, `The current host of ${game.name} is **${game.host}**.`);
			if (userid !== game.host && !this.hasPerms('%')) return this.sendPM(userid, `Changing the current host requires room staff or being the host (${game.host}).`);
			if (!(message && this.userlists[roomid][message])) return this.sendPM(userid, "Invalid user.");
			game.host = message;
			game.send(`The game's host has been changed to **${message}**.`, true);
		},
	},
};
