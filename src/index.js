import { Client, simpleFetchHandler } from '@atcute/client';
import fs from 'fs';

const client = new Client({
	handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }),
});


function isBlueskyHost(host) {
    return /^(?:https?:\/\/)?(?:[^\/]+\.)?(?:bsky\.network|bsky\.app|bsky\.dev|bsky\.social)\/?$/.test(host);
}

async function getAccountsOnPds(pds, cursor = null, accounts = []) {
  const url = `${pds}xrpc/com.atproto.sync.listRepos${cursor ? `?cursor=${cursor}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    console.log(`failed to retrieve accounts for ${pds}`);
    return [];
  }

  const data = await response.json();

  // only get at did's from the accounts, and propigate the pds
  accounts.push(...data.repos.map(acc => ({ did: acc.did, pds })));

  if (data.cursor) {
    return await getAccountsOnPds(pds, data.cursor, accounts);
  }

  return accounts;
}

async function getProfiles(actorsWithPds) {
  const dids = actorsWithPds.map(acc => acc.did);
  const didToPds = new Map(actorsWithPds.map(acc => [acc.did, acc.pds]));

  const response = await client.get('app.bsky.actor.getProfiles', {
    params: { actors: dids },
  });

  if (!response.ok) return [];

  return response.data.profiles.map(profile => ({
    ...profile,
    pds: didToPds.get(profile.did),
  }));
}

async function fetchAllAccounts(pdses, concurrency = 5) {
  const results = [];
  const queue = [...pdses];

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const pds = queue.pop();
      try {
        const accountsOnPds = await getAccountsOnPds(pds);
        results.push(...accountsOnPds);
        console.log(`Found ${accountsOnPds.length} accounts on ${pds}`);
      } catch (e) {
        console.log(`fetch error ${e}`);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// finally do the thing
async function main() {
  const data = fs.readFileSync('data.json', 'utf8');
  const json = JSON.parse(data);

  const pdses = [];
  for (const [host, val] of Object.entries(json.pdses)) {
    // i don't want to count bsky accounts
    if (isBlueskyHost(host)) continue;

    // remove any failing pdses
    if (val.errorAt) continue;

    // this is massive and full of 0 follower andies
    if (host === 'https://atproto.brid.gy/' || host === 'https://pds.si46.world/') continue;

    pdses.push(host);
  }

  const accounts = await fetchAllAccounts(pdses, 5);

  const accountsToWrite = [];
  for (let i = 0; i < accounts.length; i += 25) {
    const batch = accounts.slice(i, i + 25);
    const fetchedProfiles = await getProfiles(batch);
    accountsToWrite.push(...fetchedProfiles);
  }

  // sort the accounts by followers count
  accountsToWrite.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));

  let output = 'Rank | Handle | PDS | Followers\n----|------|-----|----------';

  for (const [i, account] of accountsToWrite.entries()) {
    output += `\n${i + 1} | ${account.handle} (${account.did}) | ${account.pds} | ${account.followersCount || 0}`;
  }

  fs.writeFileSync('dist/accounts.md', output);
}

main()
