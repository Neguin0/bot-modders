const fs = require('fs');

var Tool = {
	random(min, max) {
		return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min))) + Math.ceil(min);
	},
	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},
	Json(json) {
		return JSON.stringify(json, null, '\t');
	},
	SaveJson(file, json) {
		return fs.writeFileSync(file, JSON.stringify(json, null, '\t'));
	},
	getGroupAdmins(participants) {
		let admins = [];
		for (let i of participants) i.admin ? admins.push(i.id): '';
		return admins;
	}
};

var Color = {
	vermelho: '\u001b[31m',
	azul: '\u001b[34m',
	reset: '\u001b[0m',
	verde: '\u001B[32m',
	amarelo: '\u001B[33m',
};
var DB = JSON.parse(fs.readFileSync('./lib/db.json'))
async function SaveDB(db) {
	await fs.writeFileSync('./lib/db.json', JSON.stringify(db, null, '\t'))
}
var Prefix = "/";

module.exports = {
	Tool,
	Color,
	DB,
	SaveDB,
	Prefix,
};