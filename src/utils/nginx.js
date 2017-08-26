import { sync as glob } from 'glob';
import * as path from 'upath';
import * as fs from 'fs-extra';
import copy from './copy';
import shell from './shell';
import mkdir from './mkdir';
import compile from './compile';
import write from './write';
import {getnginxpath} from '../functions/nginx';

export async function copyconf (name) {
	await copy(ProyPath(name), path.join(await getnginxpath(), 'enabled_sites', name));
	console.log(`   ${'copying'.cyan}: ${name}`);
	await shell('Restarting Nginx', ['nginx', '-s', 'reload'], process.cwd());
}
export async function buildNginx () {
	let nginxpath = await getnginxpath();
	let conf = fs.readFileSync(nginxpath + 'nginx.conf', 'utf-8');
	if (conf.indexOf('include enabled_sites/*') === -1) {
		conf = conf.replace(/http ?\{/igm, 'http {\n\tinclude enabled_sites/*.conf;');
		fs.writeFileSync(nginxpath + 'nginx.conf', conf);
		console.log(`   ${'updated'.cyan}: nginx.conf`);
		await mkdir(nginxpath + 'enabled_sites');
	}
	let serverTemplate = fs.readFileSync(TemplatePath('subdomain.conf'), 'utf-8');
	let nginxConf = fs.readFileSync(TemplatePath('server.conf'), 'utf-8');

	let listen = '';
	if (configuration.server.https && configuration.server.https.key) {
		listen = `listen 443 ssl;\n\tssl on;\n\tssl_certificate ${configuration.server.https.cert};\n\tssl_certificate_key ${configuration.server.https.key};\n\tssl_protocols TLSv1 TLSv1.1 TLSv1.2;\n\tssl_prefer_server_ciphers on;`;
		if (configuration.server.https.dhparam) {
			listen += `\n\tssl_dhparam ${configuration.server.https.dhparam};`;
		}
	}

	nginxConf = compile(nginxConf, {
		hostname: scfg.host,
		port: scfg.port,
		protocol: listen ? 'https' : 'http'
	});
	let childsubdomains = glob('koaton_modules/**/config/server.js').map((c) => {
		return require(ProyPath(c)).default.subdomains;
	});
	childsubdomains.push(configuration.server.subdomains);
	let allsubdomains = [].concat.apply([], childsubdomains).filter((f, i, a) => a.indexOf(f) === i);
	for (const idx in allsubdomains) {
		nginxConf += compile(serverTemplate, {
			subdomain: allsubdomains[idx],
			hostname: scfg.host,
			port: scfg.port,
			listen: listen || 'listen 80',
			client_max_body_size: (configuration.server.client_max_body_size || '1M'),
			protocol: listen ? 'https' : 'http'
		});
	}
	let res = write(ProyPath(`${scfg.name}.conf`), nginxConf);
	console.log(`   ${res !== null ? __ok.green : __nok.red} Built ${scfg.name}.conf`);
}