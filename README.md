# BitBurner Scripts

A collection of scripts that I use for the game [BitBurner](https://github.com/danielyxie/bitburner)

Note: I don't promise that these scripts are fully optimized.

## Note

If you use any of the scripts in the auto/ directory, you will have to copy the scripts/ folder into the home area. The scripts under the auto/ folder will call out scripts with syntax such as "/scripts/scriptName.js", so make sure the scripts live in a scripts folder.

## Important Scripts

All the important scripts can be found under the auto folder. The scripts under the scripts folder are mainly helper scripts.

The scripts under auto are meant to be run in the background at all times. No interaction needed!

- **auto_discovery_auto_hack.js**: find all domains and spread out hack(), grow(), and weaken() threads in an optimal manner.
- **auto_gang.js**: performs gang operations as efficiently as I could think.
- **auto_purchase_servers.js**: will purchase servers with RAM equal to the passed in number. Once all purchased servers have that much RAM, the script will double the RAM and start purchasing at that level of RAM.
- **auto_stock_market.js**: performs stock market operations. This script can function with the 4S API and without it. However, it relies on shorting stocks (BN 8.1 unlock).
- **auto_upgrade_hacknet.js**: purchases and upgrades hacknets with 10% of available money. I don't use it a lot since I haven't had a need for hacknets (yet).

## Usage and Help

If you want to use these scripts, feel free!

If you have find an issue with one of the scripts, please open an issue or reach out to me on Discord at Echolyn#6969.
