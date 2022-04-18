import { tryOpenPorts, findAllDomains, killAllScripts } from "/scripts/helpers.js";

const splitHackingScripts = ["/scripts/hack_loop.js", "/scripts/grow_loop.js", "/scripts/weaken_loop.js"];
const earlyScript = "/scripts/better_hack.js";
let threadLimit = 50;

/** @param {NS} ns 
 * Create a Domain - Hack map
 * Essentially, a map telling how many threads are being spent
 *  hacking a particular domain
 * **/
function populateDomainHackMap(ns, domains) {
	let domainHackMap = new Map();
	for(let domain of domains) {
		domainHackMap.set(domain, 0);
	}

	for(let domain of domains) {
		const scripts = ns.ps(domain);
		for (let script of scripts) {
			if (splitHackingScripts.includes(script.filename) || script.filename == earlyScript) {
				for (let scriptArg of script.args) {
					if (domainHackMap.has(scriptArg)) {
						domainHackMap.set(scriptArg, (domainHackMap.get(scriptArg) + script.threads));
					}
				}
			}
		}
	}

	return domainHackMap;
}

/** @param {NS} ns 
 * This can definitely be optimized further
 * I basically want to hack servers in order of difficulty
 * But I don't want to assign too many threads to one server
 * TODO: Reset threadLimit at a fixed interval
 * **/
function findBestHackableDomain(ns, domains, domainHackMap) {
	let minHackLevel = 20000;
	let bestDomain = ""
	while(bestDomain == "") {
		for (let domain of domains) {
			const domainStats = ns.getServer(domain);
			if (domainStats.openPortCount >= domainStats.numOpenPortsRequired && domainStats.requiredHackingSkill < minHackLevel 
			&& domainHackMap.get(domain) <= threadLimit && domain != "home" && !domain.includes("cool-domain") && domainStats.moneyMax > 25000
			&& domainStats.requiredHackingSkill <= ns.getHackingLevel()) {
				bestDomain = domain;
				minHackLevel = domainStats.requiredHackingSkill;
			}
		}
		if (bestDomain == "") {
			threadLimit = threadLimit * 2;
		}
	}
	return bestDomain
}

/** @param {NS} ns 
 * This function will run a script with the given thread count
 * If the script is already running on the server, it will kill it
 *  and start it up with previous thread count + passed thread count
 * **/
async function tryRunScriptWithThreads(ns, script, domainToUse, domainToHack, threads) {
	if (!ns.fileExists(script, domainToUse)) {
		await ns.scp(script, domainToUse);
	}
	if(ns.scriptRunning(script, domainToUse)) {
		const runningScript = ns.getRunningScript(script, domainToUse, domainToHack);
		if (runningScript != null) {
			threads = threads + runningScript.threads;
			ns.kill(script, domainToUse, domainToHack);
		}
	}
	ns.exec(script, domainToUse, threads, domainToHack);
	return threads
}

/** @param {NS} ns 
 * Early game deployer with one early hack script
 * Useful when we can't run separate hack, grow, and weaken scripts
 * **/
async function earlyGameHackDeployer(ns, domainToUse, domainToHack, threads) {
	await tryRunScriptWithThreads(ns, earlyScript, domainToUse, domainToHack, threads);
}

/** @param {NS} ns 
 * Mid-late game deployer. Spreads out threads for grow, weaken, and hack
 * Always ensures that 1 thread goes to hacking
 * Values can be optimized for sure in this function
 * **/
async function efficientHackDeployer(ns, domainToUse, domainToHack, threads) {
	const growPercent = .81;
	const weakenPercent = .14;
	const hackPercent = .05;

	const growScript = "/scripts/grow_loop.js";
	const weakenScript = "/scripts/weaken_loop.js";
	const hackScript = "/scripts/hack_loop.js"

	let growThreads = Math.ceil(threads*growPercent);
	let weakenThreads = Math.floor(threads*weakenPercent);
	let hackThreads = Math.floor(threads*hackPercent);

	if (hackThreads == 0 && growThreads > 0) {
		// let's always hack with at least one thread
		growThreads = growThreads - 1;
		hackThreads = 1;
	}

	if (growThreads > 0) {
		growThreads = await tryRunScriptWithThreads(ns, growScript, domainToUse, domainToHack, growThreads);
	}
	if (weakenThreads > 0) {
		weakenThreads = await tryRunScriptWithThreads(ns, weakenScript, domainToUse, domainToHack, weakenThreads);
	}
	if (hackThreads > 0 ) {
		hackThreads = await tryRunScriptWithThreads(ns, hackScript, domainToUse, domainToHack, hackThreads);
	}
}

/** @param {NS} ns 
 * Should consider moving to general helpers if needed
 * **/
async function getHighestRamUsageFromScripts(ns, scripts) {
	let highestRam = 0
	for (let script of scripts) {
		if (ns.getScriptRam(script) > highestRam) {
			highestRam = ns.getScriptRam(script)
		}
	}
	return highestRam
}

/** @param {NS} ns 
 * Assigns domain to go hack domainToHack
 * This function will limit thread count to 5000 per script run
 * **/
async function assignDomainToHack(ns, domain, domainToHack) {

	let scriptRamUsage = await getHighestRamUsageFromScripts(ns, splitHackingScripts.concat(earlyScript));
	const domainStats = ns.getServer(domain);

	let canHack = false;

	if (domainStats.purchasedByPlayer == true) {
		canHack = true;
	} else {
		tryOpenPorts(ns, domain);

		if (domainStats.openPortCount >= domainStats.numOpenPortsRequired && domainStats.requiredHackingSkill <= ns.getHackingLevel()) {
			ns.nuke(domain);
			canHack = true;
		}
	}

	if (canHack == true) {
		let maxRam = ns.getServerMaxRam(domain);
		if (domain == "home") {
			maxRam = maxRam * .90;
		}
		const usedRam = ns.getServerUsedRam(domain);
		const availableRam = maxRam - usedRam;
		let threads = Math.floor(availableRam / scriptRamUsage);

		if (threads >= 5000) {
			threads = 5000;
		}

		// If we have more than 20 threads, lets use the mid-game deployer
		if (threads >= 20) {
			await efficientHackDeployer(ns, domain, domainToHack, threads);
		} else if (threads > 0) {
			await earlyGameHackDeployer(ns, domain, domainToHack, threads);
		}

		return threads;
	}

	return 0;
}

/** @param {NS} ns 
 * Main function loop
 * Expected to be called with 0 or 1 arguments
 * If "clean" is passed in as the only argument, it will kill
 * all the scripts running on servers other than home
 * 
 * Then, it will 
 * **/
export async function main(ns) {

	if (ns.args.length > 0) {
		if (ns.args[0] == "clean") {
			killAllScripts(ns, findAllDomains(ns));
		}
		await ns.sleep(10000);
	}

	while(true) {

		let domains = findAllDomains(ns);
		let domainHackingMap = populateDomainHackMap(ns, domains);
		let domainToHack = findBestHackableDomain(ns, domains, domainHackingMap);

		for (let domain of domains) {
			if (domainToHack != "") {
				const threadsUsed = await assignDomainToHack(ns, domain, domainToHack);
				const currentCount = domainHackingMap.get(domainToHack);
				domainHackingMap.set(domainToHack, currentCount + threadsUsed);
				if (domainHackingMap.get(domainToHack) > threadLimit) {
					domainToHack = findBestHackableDomain(ns, domains, domainHackingMap);
				}
			}
		}
		
		
		await ns.sleep(5000);

	}

}