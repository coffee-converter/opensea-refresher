const { program } = require('commander');
require('dotenv').config();
const { fetch } = require('cross-fetch');
const { OpenSeaAPI, Chain } = require("opensea-js");

const openseaAPI = new OpenSeaAPI({
  chain: Chain.Mainnet,
  apiKey: process.env.OPENSEA_API_KEY,
});

const OS_API_RETRIES = 10;

program
  .requiredOption('-a, --address <contract_address>')
  .option('-s, --start <starting_token_id>')
  .requiredOption('-e, --end <ending_token_id');

program.parse();
const options = program.opts();
console.log(options);

const ADDRESS = options.address;
const START_ID = parseInt(options.start) || 1;
const END_ID = parseInt(options.end);

const MARKETS = [
  {
    name: "OpenSea",
    msDelay: 400,
    refreshAction: async (contract, tokenId, retries = OS_API_RETRIES) => {
      await openseaAPI.refreshNFTMetadata(Chain.Mainnet, contract, tokenId.toString(), retries);
    },
    /*url: (address, tid) => `https://api.opensea.io/api/v1/asset/${address}/${tid}/?force_update=true`,
    fetchOpts: (address, tid) => ({
      cache: 'reload',
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY,
      },
    }),*/
  },
];

(async () => {
  for (const market of MARKETS) {
    await refreshMarket(market);
  }
})();

async function refreshMarket (market) {
  console.log(`\n\n*** REFRESHING ${market.name} ***`);
  const tokenIds = new Set(
    Array.from({length: END_ID - START_ID + 1}).map((x, i) => START_ID + i)
  );
  let lastFetchTime;
  while (tokenIds.size > 0) {
    try {
      const [tid] = tokenIds;

      const timeToWait = market.msDelay - Date.now() + (lastFetchTime || 0);
      if (timeToWait > 0) await new Promise(r => setTimeout(r, timeToWait));
      lastFetchTime = Date.now();

      if (market.refreshAction) {
        await market.refreshAction(ADDRESS, tid, 1);
        tokenIds.delete(tid)
      }
      else {
        const url = market.url(ADDRESS, tid);
        const opts = market.fetchOpts(ADDRESS, tid);

        const res = await fetch(url, opts);

        if (res?.status === 200) tokenIds.delete(tid);
        else if (res?.status === 404) {
          tokenIds.delete(tid);
          console.log(`\ntid ${tid} - HTTP 404`);
        }
        else throw new Error(`${res?.status} ${res?.statusText}`);
      }

      process.stdout.clearLine(-1);
      process.stdout.cursorTo(0);
      process.stdout.write(`${market.name}  TID ${tid}  ${(100 * (tid - START_ID + 1) / (END_ID - START_ID + 1)).toFixed(2)}%  ${ADDRESS}  TTW=${timeToWait}`);
    } catch (err) {
      console.log();
      console.error(err.message || err);
      await new Promise(r => setTimeout(r, market.msDelay));
    }
  }
  console.log();
}
