/** @param {NS} ns 
 * Does as it says: will attempt to open ports on passed in domain
 * **/
 export async function tryOpenPorts(ns, domain) {
	if (ns.fileExists("BruteSSH.exe", "home")) {
		ns.brutessh(domain);
	}

	if (ns.fileExists("FTPCrack.exe", "home")) {
		ns.ftpcrack(domain);
	}

	if (ns.fileExists("relaySMTP.exe", "home")) {
		ns.relaysmtp(domain);
	}

	if (ns.fileExists("HTTPWorm.exe", "home")) {
		ns.httpworm(domain);
	}

	if (ns.fileExists("SQLInject.exe", "home")) {
		ns.sqlinject(domain);
	}
}
/** @param {NS} ns 
 * A recursive function that will return all domains starting from depth to maxDepth
 * **/
export function recursiveScanForDomains(ns, domain, discoveredDomains, depth, maxDepth) {
	let domains = []
	domains.push(domain);
	if (depth != maxDepth) {
		for (let subdomain of ns.scan(domain)) {
			if (subdomain != undefined && !discoveredDomains.includes(subdomain)) {
				const newDomains = recursiveScanForDomains(ns, subdomain, domains, depth + 1, maxDepth);
				if (newDomains.length > 0) {
					domains = domains.concat(newDomains);
				}
			}
		}
	}
	return domains;
}

/** @param {NS} ns 
 * Finds all domains from root using recursive function.
 * Default depth is 25 
 * **/
export function findAllDomains(ns, depth=25) {
	let domains = [];
	let maxDepth = depth
	
	domains.push("home");

	for (let homeDomain of ns.scan("home")) {
		const newDomains = recursiveScanForDomains(ns, homeDomain, domains, 1, maxDepth);
		if (newDomains.length > 0) {
			domains = domains.concat(newDomains);
		}
	}

	return domains
}

/** @param {NS} ns 
 * Kills all scripts on the passed domains
 * **/
export function killAllScripts(ns, domains) {
	for (let domain of domains) {
		if (domain != "home") {
			ns.killall(domain);
		}
	}
}