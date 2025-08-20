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
    console.log(`failed to retrieve accounts for ${pds}: ${data.error}: ${data.message}`);
    return [];
  };

  const data = await response.json();

  accounts.push(...data.repos);

  if (data.cursor) {
    return await getAccountsOnPds(pds, data.cursor, accounts);
  }

  return accounts;
}

async function getProfile(actor) {
  const response = await client.get('app.bsky.actor.getProfile', {
    params: { actor },
  });

  if (!response.ok) return;

  return response.data;
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
    if (host === "https://atproto.brid.gy/" || host === "https://pds.si46.world/") continue;

    pdses.push(host);
  }

  const accountsToWrite = [];
  for (const pds of pdses) {
    try {
      let accountsOnPds = await getAccountsOnPds(pds);

      if (!accountsOnPds) {
        console.log(`Failed to get accounts on PDS: ${pds}`);
        continue;
      };

      console.log(`Found ${accountsOnPds.length} accounts on PDS: ${pds}`);

      for (const account of accountsOnPds) {
        if (!account) continue;

        const profile = await getProfile(account.did);

        // don't deal with the data if it has no followers / data is not available
        if (!profile?.followersCount) continue;

        if (profile) {
          accountsToWrite.push({
            did: account.did,
            handle: profile.handle,
            followersCount: profile.followersCount,
            pds: pds,
          });
        }
      }
    } catch (e) {
      console.log(`fetch error ${e}`);
      continue;
    };
  }

  // sort the accounts by followers count
  accountsToWrite.sort((a, b) => b.followersCount - a.followersCount);

  fs.writeFileSync('dist/accounts.md', 'Rank | Handle | PDS | Followers');
  fs.appendFileSync('dist/accounts.md', '\n----|------|-----|----------');

  for (const [i, account] of accountsToWrite.entries()) {
    fs.appendFileSync('dist/accounts.md', `\n${i + 1} | ${account.handle} | ${account.pds} | ${account.followersCount}`);
  }
}

main()
