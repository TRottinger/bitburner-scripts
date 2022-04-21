/** @param {NS} ns */
export async function main(ns) {

	const symbols = ns.stock.getSymbols();

    for (let i = 0; i < symbols.length; i++) {
        const sym = symbols[i];
        const position = ns.stock.getPosition(sym);
        const longShares = position[0]; 
        if (longShares > 0) {
            ns.stock.sell(sym, longShares);
        }
        const shortShares = position[2];
        if (shortShares > 0) {
            ns.stock.sellShort(sym, shortShares);
        }
    }
}