import * as Promise from 'bluebird';
import * as path from 'upath';
import * as spawn from 'cross-spawn';
import spin from '../spinner';


const spinner = spin();

export default Promise.promisify(function shell(display, command, ...args){
	let [cwd, cb] = args;
	// shelllog = "";
	if (cb === undefined) {
		cb = cwd;
		cwd = process.cwd();
	}
	if ( skipshell ) {
		console.log( `+ ${display}\t${__ok}`.green );
		cb(null,0);
		return;
	}
	let buffer = "";
	let c = null;
	const output = function(data) {
		// shelllog += data.toString();
		buffer += data.toString();
		if (buffer.indexOf('\n') > -1) {
			let send = buffer.toString().split('\n');
			spinner.pipe({
				action: "extra",
				msg: send[0].substr(0, 150).replace(/\n/igm, "")
			});
			buffer = "";
		}
	};
	try {
		const child = spawn(command[0], command.slice(1), {
			cwd: path.join(cwd, "/"),
			shell: true
		});
		spinner.start(50, display, undefined, process.stdout.columns).then(() => {
			(cb || (() => {
				console.log("No Callback".red)
			}))(null, c || child.exitCode);
		}, (err) => {
			(cb || (() => {
				console.log("No Callback".red)
			}))(err, c || child.exitCode);
		});
		child.stderr.on('data', output);
		child.stdout.on('data', output);
		child.on('close', function(code) {
			c = code;
			const msg = code === 0 ? __ok.green : __nok.red;
			spinner.end(`+ ${display}\t${msg}`.green);
		});
	} catch (err) {
		console.log(err.stack.red);
	}
})