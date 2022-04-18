/** @param {NS} ns **/

export async function main(ns) {
	const targetServer = ns.args[0];
	const moneyThreshold = ns.getServerMaxMoney(targetServer) * .8;
	const securityThreshold = ns.getServerMinSecurityLevel(targetServer) + 5;

	while(true) {
		if (ns.getServerSecurityLevel(targetServer) > securityThreshold) {
			await ns.weaken(targetServer);
		} else if (ns.getServerMoneyAvailable(targetServer) < moneyThreshold) {
			await ns.grow(targetServer);
		} else {
			await ns.hack(targetServer);
		}
	}

}