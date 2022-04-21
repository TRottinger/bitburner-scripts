/** @param {NS} ns **/

/**
 * Arg 0 = script to execute
 * Arg 1-N = args to the script
 */
export async function main(ns) {
    ns.enableLog("ALL");

	const selectedScript = ns.args[0];

	if (!ns.fileExists(selectedScript)) {
		ns.print("Selected script does not exist");
		ns.exit();
	}

	const scriptRamUsage = await ns.getScriptRam(selectedScript);

	// copy ns.args so we can modify args safely
	let scriptArgs = [...ns.args];
	scriptArgs.shift();


	while(true) {

		const domains = ns.getPurchasedServers()

		for (const domain of domains) {
			if (domain.includes("cool-domain")) {
				await ns.scp(selectedScript, domain);
				const maxRam = await ns.getServerMaxRam(domain);
				const usedRam = await ns.getServerUsedRam(domain);
				const availableRam = maxRam - usedRam;
				const threads = Math.floor(availableRam / scriptRamUsage);

				if (threads > 0) {
					await ns.exec(selectedScript, domain, threads, ...scriptArgs);
				}
			}
			
		}

		await ns.sleep(30000);

	}
	
}