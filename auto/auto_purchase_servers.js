/** @param {NS} ns **/
export async function main(ns) {

	const maxServers = 25;

	let ram = 64;
	if(ns.args.length > 0) {
		ram = ns.args[0];
	}

	const baseServerName = "cool-domain";
	
	// set variable to avoid using ns.getPurchasedServers
	// servers called cool-domain, cool-domain-0, cool-domain-1, ....
	let serverNames = [];
	serverNames.push(baseServerName);
	for (let i = 0; i < 24; i ++) {
		serverNames.push(baseServerName + "-" + i);
	}

	while(true) {
		let serverCount = 0;
		let upForDeletion = undefined;
		for (let purchasedServer of serverNames) {
			if (ns.serverExists(purchasedServer)) {
				if (ns.getServerMaxRam(purchasedServer) < ram) {
					upForDeletion = purchasedServer;
					break;
				}
				serverCount = serverCount + 1;
			}
		}
 
		// if we are full on servers, are they all have higher ram, double ram
		if (serverCount == maxServers && upForDeletion == undefined) {
			ram = ram * 2;
		} else {
			const serverCost = ns.getPurchasedServerCost(ram);
			const availableMoney = ns.getServerMoneyAvailable("home");

			if (serverCost < availableMoney * .50) {
				if (upForDeletion != undefined) {
					ns.killall(upForDeletion);
					ns.deleteServer(upForDeletion);
				}
				ns.purchaseServer(baseServerName, ram);
			}
			await ns.sleep(1000);
		}
	}

}