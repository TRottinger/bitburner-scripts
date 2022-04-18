/** @param {NS} ns **/

async function calculateMoneyToSpend(ns) {
	return ns.getServerMoneyAvailable("home") * .1; // spend only 5% of money at once;
}

export async function main(ns) {
	ns.enableLog("ALL");

	// random optimizer values
	const levelWeight = 5;
	const ramWeight = 1.7;
	const coreWeight = 1;


	while(true) {
		let numNodes = ns.hacknet.numNodes();
		let maxMoneytoSpend = await calculateMoneyToSpend(ns);

		if (ns.hacknet.getPurchaseNodeCost() < maxMoneytoSpend) {
			ns.hacknet.purchaseNode();
		} else {
			for(let i = 0; i < numNodes; i++) {
				const levelUpgradeCost = ns.hacknet.getLevelUpgradeCost(i, 1) * levelWeight;
				const ramUpgradeCost = ns.hacknet.getRamUpgradeCost(i, 1) * ramWeight;
				const coreUpgradeCost = ns.hacknet.getCoreUpgradeCost(i, 1) * coreWeight;

				if (levelUpgradeCost != Infinity && levelUpgradeCost < maxMoneytoSpend) {
					ns.hacknet.upgradeLevel(i, 1);
					await calculateMoneyToSpend(ns);
				} else if (ramUpgradeCost != Infinity && ramUpgradeCost < maxMoneytoSpend) {
					ns.hacknet.upgradeRam(i, 1);
					await calculateMoneyToSpend(ns);
				} else if (coreUpgradeCost != Infinity && coreUpgradeCost < maxMoneytoSpend) {
					ns.hacknet.upgradeCore(i, 1);
					await calculateMoneyToSpend(ns);
				}
			}
		}

		await ns.sleep(1000);
	}

}