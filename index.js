const { program } = require('commander');
require('dotenv').config();
const { fetch } = require('cross-fetch');

program
  .requiredOption('-a, --address <contract_address>')
  .option('-s, --start <starting_token_id>')
  .requiredOption('-e, --end <ending_token_id');

program.parse();
const options = program.opts();
console.log(options);

const address = options.address;
const startId = parseInt(options.start) || 1;
const endId = parseInt(options.end);

const tokenIds = new Set(
  Array.from({length: endId - startId + 1}).map((x, i) => startId + i)
);

(async () => {
  let lastFetchTime = Date.now();
  let timeToWait;
  while (tokenIds.size > 0) {
    try {
      const [tokenId] = tokenIds;
      const url = `https://api.opensea.io/api/v1/asset/${address}/${tokenId}/?force_update=true`;

      timeToWait = 333 - Date.now() + lastFetchTime;
      if (timeToWait > 0) await new Promise(r => setTimeout(r, timeToWait));

      lastFetchTime = Date.now();
      const res = await fetch(url, {
        cache: 'reload',
        headers: {
          'X-API-KEY': process.env.OPENSEA_API_KEY
        }
      });

      if (res?.status !== 200) {
        throw new Error(`${res?.status} ${res?.statusText}`);
      }
      else {
        tokenIds.delete(tokenId);
      }

      process.stdout.clearLine(-1);
      process.stdout.cursorTo(0);
      process.stdout.write(`TID ${tokenId}  ${(100 * (tokenId - startId + 1) / (endId - startId + 1)).toFixed(2)}%  ${address}  TTW=${timeToWait}`);
    }
    catch (err) {
      console.log();
      console.error(err);
    }
  }
  console.log();
})();
