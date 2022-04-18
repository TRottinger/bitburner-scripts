/**
 * First pass at a hacking gang script
 * Reserve  half of members for ethical hacking
 * Other members can go do all the hacking crimes
 */

let moneyThreshold = .50;
const letters = "A B C D E F G H I J K L M N O P Q R S T U W V Y Z".split(" ");
let suffixIndex = 0;
let prefixIndex = 0;

let tasks = new Map();
let gangInfo;
let equipment = []
let ascCooldown = 10; // wait 10 loops before ascending someone again
let currAscCooldown = 0;
let territoryWarfareInterval = 20000; // every 20 seconds, we should train warfare

/** @param {NS} ns **/
function getNextName() {
    if (suffixIndex > letters.length) {
        currentIndex = 0;
        prefixIndex += 1;
    }

    if (prefixIndex > letters.length) {
        return null;
    }
    const name = letters[prefixIndex] + letters[suffixIndex];
    suffixIndex += 1;
    return name;
}

/** @param {NS} ns **/
function calculateMoneyToSpend(ns) {
    return ns.getServerMoneyAvailable("home") * moneyThreshold; // spend only 10% of money at once;
}

/** @param {NS} ns **/
function tryRecruitMember(ns) {
    if(ns.gang.canRecruitMember()) {
        const name = getNextName()
        if (name != null) {
            ns.gang.recruitMember(name);
        }
    }
}

/** @param {NS} ns **/
function tryPurchase(ns, member) {
    for (let equip of equipment) {
        if (ns.gang.getEquipmentCost(equip) < calculateMoneyToSpend(ns)) {
            ns.gang.purchaseEquipment(member, equip);
        }
    }
}

/** @param {NS} ns **/
function tryAscend(ns, member) {
    const ascensionResult = ns.gang.getAscensionResult(member);
    if (ascensionResult && ascensionResult.hack > 1.2) {
        const res = ns.gang.ascendMember(member);
        if (res) {
            currAscCooldown = ascCooldown;
        }
    }
}

function setTaskProperties(name, wanted, respect, money) {
    let task = {};
    task.name = name;
    task.wanted = wanted;
    task.respect = respect;
    task.money = money;
    task.combined = respect + money;
    task.canLowerBy = 0;
    return task
}

/** @param {NS} ns **/
function getMemberBestTaskInfo(ns, name, focusedStat) {
    const memberStats = ns.gang.getMemberInformation(name);

    let memberTaskInfo = {
        name: "",
        wanted: 0,
        respect: 0,
        money: 0,
        combined: 0,
        canLowerBy: 0
    }

    for (let [taskName, taskStats] of tasks) {
        const wantedGainStat = getWantedGainForTaskByMember(ns, taskStats, memberStats);
        const respectGainStat = getRespectGainForTaskByMember(ns, taskStats, memberStats);
        const moneyGainStat = getMoneyGainForTaskByMember(ns, taskStats, memberStats);
        const adjustedMoneyGainStat = moneyGainStat / 10000;

        // I'm lazy and don't feel like optimizing. don't do tasks with more than .25 wanted level
        if ( wantedGainStat <= .10 ) {
            if (focusedStat == "combined") {
                if (respectGainStat + adjustedMoneyGainStat > memberTaskInfo.combined) {
                    memberTaskInfo = setTaskProperties(taskName, wantedGainStat, respectGainStat, adjustedMoneyGainStat);
                }
            } else if (focusedStat == "money") {
                if (adjustedMoneyGainStat > memberTaskInfo.money) {
                    memberTaskInfo = setTaskProperties(taskName, wantedGainStat, respectGainStat, adjustedMoneyGainStat);
                }
            } else if (focusedStat == "respect") {
                if (respectGainStat > memberTaskInfo.respect) {
                    memberTaskInfo = setTaskProperties(taskName, wantedGainStat, respectGainStat, adjustedMoneyGainStat);
                }
            } else if (focusedStat == "territory") {
                if (taskName == "Territory Warfare") {
                    memberTaskInfo = setTaskProperties(taskName, wantedGainStat, respectGainStat, adjustedMoneyGainStat);
                }
            }
            if (wantedGainStat < memberTaskInfo.canLowerBy) {
                memberTaskInfo.canLowerBy = wantedGainStat;
            }
        }
    }

    return memberTaskInfo;
}

/**  **/
function getWantedPenalty() {
    return (gangInfo["respect"] / (gangInfo["respect"] + gangInfo["wantedLevel"]));
}

/** **/
function getTerritoryPentalty() {
    return (gangInfo["territory"] * 0.2 + 0.8);
}

/** **/
function getTerritoryWeight(territoryExponent) {
    return (Math.pow(gangInfo["territory"] * 100, territoryExponent) / 100);
}

/** @param {NS} ns
 * Logic function taken from source to calculate wainted gain rate
 *  **/
function getWantedGainForTaskByMember(ns, taskStats, memberStats) {
    if (taskStats["baseWanted"] == 0) {
        return 0;
    }
    
    const weight = getMemberWeightForTask(taskStats, memberStats);
    const weightWithDifficulty = weight - 3.5 * taskStats["difficulty"]

    if (weightWithDifficulty <= 0) {
        return 0;
    }

    const territoryWeight = getTerritoryWeight(taskStats["territory"]["wanted"])

    if (taskStats["baseWanted"] > 0) {
        return (7 * taskStats["baseWanted"] / (Math.pow(3 * weightWithDifficulty * territoryWeight, 0.8)));
    } else {
        return (0.4 * taskStats["baseWanted"] * weightWithDifficulty * territoryWeight);
    }
}

/** @param {NS} ns
 * Logic function taken from source to calculate money gain rate
 *  **/
function getMoneyGainForTaskByMember(ns, taskStats, memberStats) {
    if (taskStats["baseMoney"] == 0) {
        return 0
    }

    const weight = getMemberWeightForTask(taskStats, memberStats);
    const weightWithDifficulty = weight - 3.2 * taskStats["difficulty"];

    if (weightWithDifficulty <= 0) {
        return 0;
    }

    const territoryWeight = getTerritoryWeight(taskStats["territory"]["money"]);

    if (territoryWeight <= 0) {
        return 0;
    }

    const territoryPenalty = getTerritoryPentalty();
    const wantedPen = getWantedPenalty();

    return Math.pow(5 * taskStats["baseMoney"] * weightWithDifficulty * territoryWeight * wantedPen, territoryPenalty);
}

/** @param {NS} ns
 * Logic function taken from source to calculate reputation gain rate
 *  **/
function getRespectGainForTaskByMember(ns, taskStats, memberStats) {
    if (taskStats["baseRespect"] == 0) {
        return 0;
    }

    const weight = getMemberWeightForTask(taskStats, memberStats);
    const weightWithDifficulty = weight - 4 * taskStats["difficulty"];

    if (weightWithDifficulty <= 0) {
        return 0;
    }

    const territoryWeight = getTerritoryWeight(taskStats["territory"]["respect"]);

    if (territoryWeight <= 0) {
        return 0;
    }

    const territoryPenalty = getTerritoryPentalty();
    const wantedPen = getWantedPenalty();

    return Math.pow(11 * taskStats["baseRespect"] * weightWithDifficulty * territoryWeight * wantedPen, territoryPenalty);
}

/**
 * Returns calculated weight based on task stats and member stats
 * **/
function getMemberWeightForTask(taskStats, memberStats) {
    const weight = 
        taskStats["hackWeight"] / 100 * memberStats["hack"] +
        taskStats["strWeight"] / 100 * memberStats["str"] +
        taskStats["agiWeight"] / 100 * memberStats["agi"] +
        taskStats["defWeight"] / 100 * memberStats["def"] +
        taskStats["dexWeight"] / 100 * memberStats["dex"] +
        taskStats["chaWeight"] / 100 * memberStats["cha"];

    return weight;
}

async function gangLoop(ns, focusedStat, trainCombat) {
    tryRecruitMember(ns);
    const members = ns.gang.getMemberNames();
    gangInfo = ns.gang.getGangInformation();

    if (trainCombat) {
        await assignAllToTask(ns, "Train Combat");
    } else {

        let taskMap = new Map();
        let coolMap = new Map();

        let totalNegativeWantedGainLeft = 0.0;
        for (let member of members) {
            tryPurchase(ns, member);

            if (currAscCooldown == 0) {
                tryAscend(ns, member);
            }
            
            const taskInfo = getMemberBestTaskInfo(ns, member, focusedStat);
            taskMap.set(member, taskInfo);
            coolMap.set(taskInfo.combined, member);
            totalNegativeWantedGainLeft = totalNegativeWantedGainLeft + taskInfo.canLowerBy;

        }

        if (focusedStat != "territory") {
            let cumulativeWantedPool = 0.0;
            let optimizedValues = Array.from(coolMap.keys());
            optimizedValues.sort(function(a, b){ return b - a});
            
            for (let optimizedValue of optimizedValues) {
                const memberName = coolMap.get(optimizedValue);
                const taskInfo = taskMap.get(memberName);

                if (taskInfo.combined == 0) {
                    ns.gang.setMemberTask(memberName, "Train Hacking");
                    totalNegativeWantedGainLeft = totalNegativeWantedGainLeft - taskInfo.canLowerBy;
                } else if (-1*(totalNegativeWantedGainLeft - taskInfo.canLowerBy) > cumulativeWantedPool + taskInfo.wanted) {
                    ns.gang.setMemberTask(memberName, taskInfo.name);
                    totalNegativeWantedGainLeft = totalNegativeWantedGainLeft - taskInfo.canLowerBy;
                    cumulativeWantedPool = cumulativeWantedPool + taskInfo.wanted;
                } else if (-1*(totalNegativeWantedGainLeft - taskInfo.canLowerBy) > cumulativeWantedPool) {
                    ns.gang.setMemberTask(memberName, "Train Hacking");
                    totalNegativeWantedGainLeft = totalNegativeWantedGainLeft - taskInfo.canLowerBy;
                } else {
                    ns.gang.setMemberTask(memberName, "Ethical Hacking");
                    totalNegativeWantedGainLeft = totalNegativeWantedGainLeft - taskInfo.canLowerBy;
                    cumulativeWantedPool = cumulativeWantedPool + taskInfo.canLowerBy;
                }
            }
        }
        else {
            for(let member of members) {
                ns.gang.setMemberTask(member, "Territory Warfare");
            }
        }

        if(currAscCooldown != 0) {
            currAscCooldown = currAscCooldown - 1;
        }
    }
}

async function assignAllToTask(ns, taskName) {
    const members = ns.gang.getMemberNames();
    for (let member of members) {
        ns.gang.setMemberTask(member, taskName);
    }
}

/** @param {NS} ns 
 *
 * **/
export async function main(ns) {

    let focusedStat = "combined";
    if(ns.args.length > 0) {
        if(ns.args[0] == "money") {
            focusedStat = "money"
        } else if (ns.args[0] == "respect") {
            focusedStat = "respect"
        } else if (ns.args[0] == "territory") {
            focusedStat = "territory"
        }
    }

    for (let task of ns.gang.getTaskNames()) {
        const stats = ns.gang.getTaskStats(task);
        if(stats["isHacking"]) {
            tasks.set(task, stats);
        }
    }

    for (let equip of ns.gang.getEquipmentNames()) {
        equipment.push(equip);
    }

    let foundTerritoryChange = false;
    let nextTerritoryChange
    const lastPowerCheck = ns.gang.getOtherGangInformation()["The Black Hand"].power;

    if (ns.gang.getBonusTime() > 10000) {
        territoryWarfareInterval = 1000;
    }

    while(!foundTerritoryChange) {
        if (ns.gang.getOtherGangInformation()["The Black Hand"].power != lastPowerCheck) {
            nextTerritoryChange = Date.now() + territoryWarfareInterval - 200; // little bit of error on the time
            foundTerritoryChange = true;
        }
        await ns.sleep(25);
    }

    let trainCombatTimer = 10;

    while(true) {
        if (Date.now() + 500 > nextTerritoryChange) {
            if (ns.gang.getBonusTime() < 10000) {
                territoryWarfareInterval = 20000;
            }
            let currentGangPower = ns.gang.getGangInformation().power;
            await assignAllToTask(ns, "Territory Warfare");
            while(currentGangPower === ns.gang.getGangInformation().power) {
                await ns.sleep(10);
            }
            currentGangPower = ns.gang.getGangInformation().power
            nextTerritoryChange = Date.now() + territoryWarfareInterval - 200;
            let trainCombat = false;
            if (trainCombatTimer == 0) {
                trainCombat = true;
                trainCombatTimer = 10;
            }
            await gangLoop(ns, focusedStat, trainCombat);
            trainCombatTimer = trainCombatTimer - 1;
            await ns.sleep((nextTerritoryChange - Date.now()) / 1.5);
        }  else {
            await ns.sleep(10);
        }
    }
}