import { Client, simpleFetchHandler } from '@atcute/client';
import fs from 'fs';

const client = new Client({
	handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }),
});


function isBlueskyHost(host) {
    return /^(?:https?:\/\/)?(?:[^\/]+\.)?(?:bsky\.network|bsky\.app|bsky\.dev|bsky\.social)\/?$/.test(host);
}

async function getAccountsOnPds(pds, cursor = null, accounts = []) {
  try {
    const url = `${pds}xrpc/com.atproto.sync.listRepos${cursor ? `?cursor=${cursor}` : ''}`;

    const data = await (await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })).json() || {};

    if (data.error != null) {
      console.log(JSON.stringify(data, null, 2));
      return [];
    }

    accounts.push(...data.repos);

    if (data.cursor) {
      return getAccountsOnPds(pds, data.cursor, accounts);
    }

    return accounts;
  } catch (err) {
    console.log(`failed to get data for ${pds}`);
    return null;
  }
}

async function getProfile(actor) {
  try {
    const response = await client.get('app.bsky.actor.getProfile', {
      params: { actor },
    });

    return response.data;
  } catch (error) {
    console.log('Error fetching followers count:', error);
    return null;
  }
}

// finally do the thing

async function main() {
  const data = fs.readFileSync('data.json', 'utf8');
  const json = JSON.parse(data);

  const pdses = [];
  for (const [host, val] of Object.entries(json.pdses)) {
    if (isBlueskyHost(host)) continue;
    if (val.errorAt != null) continue;

    // this is massive and full of 0 fillower andies
    if (host == "https://atproto.brid.gy/") continue;
    if (hosy == "https://pds.si46.world/") continue;

    pdses.push(host);
  }

  const accountsToWrite = [];
  for (const pds of pdses) {
    console.log(`Fetching accounts from PDS: ${pds}`);
    let accountsOnPds = await getAccountsOnPds(pds);
    if (!accountsOnPds) continue;
    console.log(`Found ${accountsOnPds.length} accounts on PDS: ${pds}`);

    for (const account of accountsOnPds) {
      if (!account) continue;

      const profile = await getProfile(account.did);
      if (profile) {
        accountsToWrite.push({
          did: account.did,
          handle: profile.handle,
          followersCount: profile.followersCount,
          pds: pds,
        });
      }
    }
  }

  accountsToWrite.sort((a, b) => a.followersCount - b.followersCount);

  fs.writeFileSync('dist/accounts.txt', 'Handle | PDS | Followers Count\n');
  fs.appendFileSync('dist/accounts.txt', '------|-----|------------------------\n');

  for (const account of accountsToWrite) {
    fs.appendFileSync('dist/accounts.txt', `${account.handle} | ${account.pds} | ${account.followersCount}\n`);
  }
}

main()
