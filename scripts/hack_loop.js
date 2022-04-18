/** @param {NS} ns **/
export async function main(ns) {
	const domainToHack = ns.args[0];
	while(true) {
		await ns.hack(domainToHack);
	}
}