import * as path from 'path';
import * as fs from 'graceful-fs';
import {
	sync
} from 'glob';
import MutableArray from './MutableArray';
import BundleItem from './BundleItem';
import CommandLog from './CommandLog';
import Model from './ORMModel';
import MM from '../modelmanager';
// import EmberAppItem from './EmberAppItem';

const ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
let id = 0;

export default class ServerConfiguaration {
	UpdateKoaton() {
		fs.writeFileSync(ProyPath(".koaton"), JSON.stringify(this.localkoaton, 2, 2));
	}
	UpdateModule(filepath) {
		fs.writeFileSync(filepath, '"use strict";\nmodule.exports=' + JSON.stringify(this.emberApps, 4, 4));
	}
	constructor() {
		this.port = process.env.port;
		this.env = process.env.NODE_ENV;
		if (!fs.existsSync(ProyPath(".koaton"))) {
			fs.writeFileSync(ProyPath(".koaton"), JSON.stringify({
				bundles: {},
				database: {
					models: {},
					relations: {}
				},
				commands: []
			}, 4, 4));
		}
		const localkoaton = JSON.parse(fs.readFileSync(ProyPath(".koaton"), 'utf-8'));
		// const embercfg = require(ProyPath('config', 'ember'));

		this.id = ++id;
		Object.defineProperty(this, 'package', {
			enumerable: false,
			value: require(ProyPath('package.json'))
		});
		Object.defineProperty(this, 'localkoaton', {
			enumerable: false,
			value: {
				bundles: {},
				database: {},
				commands: localkoaton.commands || []
			}
		});
		Object.defineProperty(this, '_emberapps', {
			enumerable: false,
			value: require(ProyPath('config', 'ember')) || {}
		});
		makeObjIterable(this._emberapps);
		Object.defineProperty(this, 'localserver', {
			enumerable: false,
			value: require(ProyPath("config", "server"))
		});
		this.commands = new CommandLog(this.localkoaton, 'commands', this.UpdateKoaton.bind(this))
		this.bundles = new MutableArray(BundleItem, this.localkoaton, 'bundles', this.UpdateKoaton.bind(this));
		// this.emberApps = new MutableArray(EmberAppItem, this, '_emberapps', this.UpdateModule.bind(this, ProyPath("config", "ember.js")));
		// for (const app in embercfg) {
		// 	this.emberApps.add(app, embercfg[app]);
		// }

		this.database = new MutableArray(Model, this.localkoaton, 'database', this.UpdateKoaton.bind(this));
		this.database.toJSON = function() {
			let result = {
				models: {},
				relations: []
			};
			for (const model of this.target) {
				result.models[model._modelname] = model.toMeta().model
				result.relations.concat(model.toMeta().relations);
			}
			return result;
		};
		for (const idx in localkoaton.bundles) {
			this.bundles.add(idx, localkoaton.bundles[idx]);
		}
		sync(ProyPath("models", "*.js")).forEach((files) => {
			this.database.add(MM(path.basename(files).replace(".js", ""), require(files)));
		});
		Object.defineProperty(this.database, 'models', {
			get: function() {
				return this.toJSON().models;
			}
		});
		Object.defineProperty(this.database, 'relations', {
			get: function() {
				return this.toJSON().relations;
			}
		});

		Object.freeze(this.bundles);
		Object.freeze(this.database);
		Object.freeze(this.commands);
	}
	get name(){
		return this.package.name;
	}
	get dev() {
		return this.env === "development";
	}
	get token_timeout() {
		return this.dev ? this.localserver.token_timeout.dev : this.localserver.token_timeout.prod;
	}
	get host() {
		return this.dev ? this.localserver.host.dev : this.localserver.host.prod;
	}
	get version() {
		return this.package.version;
	}
	get hostname() {
		if (this.host.match(ipformat)) {
			return this.host;
		} else if (this.host.indexOf("www") === 0) {
			return this.host;
		} else if (this.host !== "localhost") {
			return "www." + this.host;
		} else {
			return this.host;
		}
	}
	get relations_mode() {
		return this.localserver.relation_mode === 'ids';
	}
	get emberApps(){
		return this._emberapps;
	}
}