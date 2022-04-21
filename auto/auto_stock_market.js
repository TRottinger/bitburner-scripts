/**
 * Auto stock market script
 * Will use manual sampling if user has no access to 4S API
 * Otherwise, will use 4S API to calculate optimal investments
 * This script assumes you can SHORT STOCKS!
 *
 */

const commission = 100000;
const numCycles = 1;
let equity = 0;
let minLiquid = 0;
let maxOwnedShares = 50000;
const samplingLength = 30;

const percentKeepLiquid = 0.05; // keep 5% of assets in cash
/**
 * Get stock data based on symbol
 * 
 * @param {NS} ns
 * @param {string} sym
 */

function getStockInfo(ns, sym) {
    let stockInfo = {};
    stockInfo.sym = sym;
    stockInfo.price = ns.stock.getPrice(sym);
    stockInfo.askPrice = ns.stock.getAskPrice(sym);
    stockInfo.bidPrice = ns.stock.getBidPrice(sym);
    stockInfo.maxShares = ns.stock.getMaxShares(sym);
    const position = ns.stock.getPosition(sym);
    stockInfo.longShares = position[0];
    stockInfo.longPrice = position[1];
    stockInfo.shortShares = position[2];
    stockInfo.shortPrice = position[3];

    if (ns.getPlayer().has4SDataTixApi) {
        stockInfo.vol = ns.stock.getVolatility(sym);
        stockInfo.prob = 2 * (ns.stock.getForecast(sym) - 0.5);
        stockInfo.expRet = stockInfo.vol * stockInfo.prob / 2;
    }

    return stockInfo;
}

/** 
 * Refreshes stock data
 * @param {NS} ns Game namespace
 * @param {[]} symbols Stocks to be analyzed
 * @param {[]} myLongStocks Owned long stocks
 * @param {[]} myShortStocks Owned long stocks
 */
function refreshStockData(ns, symbols) {
    let stocks = [];

    //refresh stock data
    for (let i = 0; i < symbols.length; i++) {
        let sym = symbols[i];
        let stockInfo = getStockInfo(ns, sym);
        stocks.push(stockInfo);
    }

    return stocks;
}

/**
 * Calculates equity
 * 
 * @param {NS} ns
 * @param {[]} longStocks
 * @param {[]} shortStocks
 */
function calculateEquity(ns, longStocks, shortStocks) {
    equity = ns.getServerMoneyAvailable("home");
    longStocks.forEach((stock) => {
        equity += stock.longShares * stock.bidPrice;
    })
    shortStocks.forEach((stock) => {
        equity += stock.shortShares * stock.askPrice;
    })
    maxOwnedShares = Math.max(Math.sqrt(equity) * 8, 10000);
    return equity
}

/**
 * Converts some stocks to cash based on liquid %
 * 
 * @param {NS} ns
 * @param {[]} longStocks
 * @param {[]} shortStocks
 * 
 **/
function liquidize(ns, longStocks, shortStocks) {
    let cash = ns.getServerMoneyAvailable("home");
    minLiquid = (cash + equity) * percentKeepLiquid;
    let shortIndex = shortStocks.length - 1;
    let longIndex = longStocks.length - 1;
    while (cash < minLiquid) {
        if (longIndex < 0 && shortIndex < 0) {
            break;
        }
        if (shortIndex < 0) {
            const minShares = Math.ceil((minLiquid - cash) / longStocks[longIndex].askPrice);
            sell(ns, longStocks[longIndex].sym, minShares, longStocks[longIndex].longPrice);
            longIndex -= 1;
        } else if (longIndex < 0) {
            const minShares = Math.ceil((minLiquid - cash) / shortStocks[shortIndex].bidPrice);
            sell(ns, shortStocks[shortIndex].sym, minShares, shortStocks[shortIndex].shortPrice);
            shortIndex -= 1;
        } else if (longStocks[longIndex].expRet <= -1 * shortStocks[shortIndex].expRet) {
            const minShares = Math.ceil((minLiquid - cash) / longStocks[longIndex].askPrice);
            sell(ns, longStocks[longIndex].sym, minShares, longStocks[longIndex].longPrice);
            longIndex -= 1;
        } else {
            const minShares = Math.ceil((minLiquid - cash) / shortStocks[shortIndex].bidPrice);
            sell(ns, shortStocks[shortIndex].sym, minShares, shortStocks[shortIndex].shortPrice);
            shortIndex -= 1;
        }
        cash = ns.getServerMoneyAvailable("home");
        minLiquid = (cash + equity) * percentKeepLiquid;
    }
}

/**
 * Buys stock
 * @param {NS} ns Game namespace
 * @param {string} sym Stock to buy
 * @param {number} numShares Number of shares to buy
 */
function buy(ns, sym, numShares) {
    let actualPrice = ns.stock.buy(sym, numShares);
    let cost = actualPrice * numShares;
    return cost;
}

/**
 * Shorts stock
 * @param {NS} ns Game namespace
 * @param {string} sym Stock to short
 * @param {number} numShares Number of shares to short
 */
function short(ns, sym, numShares) {
    let actualPrice = ns.stock.short(sym, numShares);
    let cost = actualPrice * numShares;
    return cost;
}

/**
 * Sells stock
 * @param {NS} ns Game namespace
 * @param {string} sym Stock symbol to sell
 * @param {number} numShares Number of shares to sell
 * @param {number} buyPrice the price the stock was bought at
 */
function sell(ns, sym, numShares, buyPrice) {
    let sellPrice = ns.stock.sell(sym, numShares);
    let profit = (sellPrice - buyPrice) * numShares;
    return profit;
}

/**
 * Sells shorts
 * @param {NS} ns Game namespace
 * @param {string} sym Stock symbol to sell
 * @param {number} numShares Number of shares to sell
 * @param {number} buyPrice the price the stock was bought at
 */
function sellShort(ns, sym, numShares, buyPrice) {
    let sellPrice = ns.stock.sellShort(sym, numShares);
    let profit = (buyPrice - sellPrice) * numShares;
    return profit;
}

/**
 * Sell all longs and shorts
 * @param {NS} namespace
 * @params {[]} symbols
 */
function sellAll(ns, symbols) {
    for (let i = 0; i < symbols.length; i++) {
        const stockInfo = getStockInfo(ns, symbols[i]);
        if (stockInfo.longShares > 0) {
            sell(ns, stockInfo.sym, stockInfo.longShares, stockInfo.longPrice);
        }
        if (stockInfo.shortShares > 0) {
            sellShort(ns, stockInfo.sym, stockInfo.shortShares, stockInfo.shortPrice);
        }
    }
}

/**
 * Credit: /u/peter_lang on reddit
 * Predicts state of stocks without 4S API
 * Returns 1 if the expected state is good for LONG
 * Returns -1 if the expected state is good for SHORT
 * 
 * @param {[]} samples
 */

function predictState(samples) {
const limits = [null, null, null, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 12, 12, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 19, 19, 20];
let inc = 0;
for (let i = 0; i < samples.length; ++i) {
    const total = i + 1;
    const idx = samples.length - total;
    if (samples[idx] > 1.) {
    ++inc;
    }
    const limit = limits[i];
    if (limit === null) {
    continue;
    }
    if (inc >= limit) {
    return 1;
    }
    if ((total-inc) >= limit) {
    return -1;
    }
}
return 0;
}

/**
 * Credit: /u/peter_lang on reddit
 * Formats big numbers into abbreviated versions
 * @param {number} money Number to format
 */
function format(money) {
    const prefixes = ["", "k", "m", "b", "t", "q"];
    for (let i = 0; i < prefixes.length; i++) {
        if (Math.abs(money) < 1000) {
            return `${Math.floor(money * 10) / 10}${prefixes[i]}`;
        } else {
            money /= 1000;
        }
    }
    return `${Math.floor(money * 10) / 10}${prefixes[prefixes.length - 1]}`;
}

/**
 * Credit: /u/peter_lang on reddit
 * @param {[]} samples
 */
function posNegDiff(samples) {
const pos = samples.reduce((acc, curr) => acc + (curr > 1. ? 1 : 0), 0);
return Math.abs(samples.length - 2*pos);
}

/**
 * Credit: /u/peter_lang on reddit
 * @param {[]} samples
 */
function posNegRatio(samples) {
const pos = samples.reduce((acc, curr) => acc + (curr > 1. ? 1 : 0), 0);
return Math.round(100*(2*pos / samples.length - 1));
}

/**
 * Get money to spend
 * 
 * @param {NS} ns 
 */
function getMoneyToSpend(ns) {
    let money = ns.getServerMoneyAvailable("home");
    money = money - minLiquid;
    return money;
}

/** 
 * This function
 * 
 * @param {NS} ns  
 */
async function noApiLoop(ns) {
    let symbols = ns.stock.getSymbols();
    let symLastPrice = {};
    let symChanges = {};
    for (const sym of symbols) {
    symLastPrice[sym] = ns.stock.getPrice(sym);
    symChanges[sym] = []
    }

    while(!ns.getPlayer().has4SDataTixApi) {
        await ns.sleep(2000);

        if (symLastPrice['FSIG'] === ns.stock.getPrice('FSIG')) {
            continue;
        }

        for (const sym of symbols) {
            const current = ns.stock.getPrice(sym);
            symChanges[sym].push(current/symLastPrice[sym]);
            symLastPrice[sym] = current;
            if (symChanges[sym].length > samplingLength) {
            symChanges[sym] = symChanges[sym].slice(symChanges[sym].length - samplingLength);
            }
        }

        const prioritizedSymbols = [...symbols];
        prioritizedSymbols.sort((a, b) => posNegDiff(symChanges[b]) - posNegDiff(symChanges[a]));

        const stocks = refreshStockData(ns, symbols);
        
        for (const stock of stocks) {
            const state = predictState(symChanges[stock.sym]);

            if (stock.longShares <= 0 && stock.shortShares <= 0 && stock.price < 1000) {
                continue;
            }

            if (stock.longShares > 0) {
                if (state < 0) {
                    sell(ns, stock.sym, stock.longShares, stock.longPrice);
                }
            } else if (stock.shortShares > 0) {
                if (state > 0) {
                    sellShort(ns, stock.sym, stock.shortShares, stock.shortPrice);
                }
            } else {
                const money = getMoneyToSpend(ns);
                if (state > 0) {
                    const sharesToBuy = Math.min(10000, stock.maxShares, Math.floor((money - commission) / stock.askPrice));
                    buy(ns, stock.sym, sharesToBuy);
                } else if (state < 0) {
                    const sharesToBuy = Math.min(10000, stock.maxShares, Math.floor((money - commission) / stock.bidPrice));
                    short(ns, stock.sym, sharesToBuy);
                }
            }
        }
    }
    return true;
}

/**
 * This function 
 * @param {NS} ns Game namespace
 */
async function apiLoop(ns) {
    let symbols = ns.stock.getSymbols();
    let stocks = [];
    while(true) {
        stocks = refreshStockData(ns, symbols);

        let myLongStocks = [];
        let myShortStocks = [];
        for (const stock of stocks) {
            if (stock.longShares > 0) {
                myLongStocks.push(stock);
            }
            if (stock.shortShares > 0) {
                myShortStocks.push(stock);
            }
        }
        stocks.sort(function (a, b) { return b.expRet - a.expRet });
        myLongStocks.sort(function (a, b) { return b.expRet - a.expRet });
        myShortStocks.sort(function (a, b) { return a.expRet - b.expRet });

        calculateEquity(ns, myLongStocks, myShortStocks);
        liquidize(ns, myLongStocks, myShortStocks);

        let longIndex = 0;
        let shortIndex = stocks.length - 1;
        let bestLongStock = stocks[longIndex];
        let bestShortStock = stocks[shortIndex];

        let maxLongSharesAvailable = bestLongStock.maxShares - bestLongStock.longShares;
        let maxShortSharesAvailable = bestShortStock.maxShares - bestShortStock.shortShares;
        
        while (bestLongStock.longShares >= Math.min(maxLongSharesAvailable, maxOwnedShares)) {
            longIndex += 1;
            if (longIndex < stocks.length) {
                bestLongStock = stocks[longIndex];
                maxLongSharesAvailable = bestLongStock.maxShares - bestLongStock.longShares;
            } else {
                bestLongStock = null;
            }
        }

        while (bestShortStock.shortShares >= Math.min(maxShortSharesAvailable, maxOwnedShares)) {
            shortIndex -= 1;
            if (shortIndex >= 0) {
                bestShortStock = stocks[shortIndex];
                maxShortSharesAvailable = bestShortStock.maxShares - bestShortStock.shortShares;
            } else {
                bestShortStock = null;
            }
        }

        if (bestLongStock != null) {
            for (let i = 0; i < myLongStocks.length; i++) {
                if (bestLongStock.expRet > myLongStocks[i].expRet) {
                    sell(ns, myLongStocks[i].sym, myLongStocks[i].longShares, myLongStocks[i].longPrice);
                }
            }
        }

        if (bestShortStock != null) {
            for (let i = 0; i < myShortStocks.length; i++) {
                if (bestShortStock.expRet < myShortStocks[i].expRet) {
                    sellShort(ns, myShortStocks[i].sym, myShortStocks[i].shortShares, myShortStocks[i].shortPrice);
                }
            }
        }

        //Buy shares with cash remaining in hand
        let cashToSpend = getMoneyToSpend(ns);
        //calculate max number of shares to buy
        if (bestLongStock != null) {
            let numBuyShares = Math.min(Math.floor((cashToSpend - commission) / bestLongStock.askPrice), maxLongSharesAvailable, maxOwnedShares);
            let cost = buy(ns, bestLongStock.sym, numBuyShares);
            cashToSpend = cashToSpend - cost;
        }

        if (bestShortStock != null) {
            let numShortShares = Math.min(Math.floor((cashToSpend - commission) / bestShortStock.bidPrice), maxShortSharesAvailable, maxOwnedShares);
            short(ns, bestShortStock.sym, numShortShares);
        }
        await ns.sleep(6 * 1000 * numCycles + 200);
    }
}

/**
 * Program entry point
 * @param {NS} ns Game namespace
 * */
export async function main(ns) {
    //Initialise
    ns.disableLog("ALL");
    const returned = await noApiLoop(ns);

    if (returned) {
        sellAll(ns, ns.stock.getSymbols());
        await ns.sleep(5000);
        await apiLoop(ns);
    }
}