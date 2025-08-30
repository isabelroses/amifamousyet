import { Client, simpleFetchHandler } from "@atcute/client";
import { AppBskyActorDefs } from "@atcute/bluesky";
import type { Did } from "@atcute/lexicons";
import fs from "fs";

interface didWithPds {
  did: Did;
  pds: string;
}

interface profileWithPds extends AppBskyActorDefs.ProfileViewDetailed {
  pds: string;
}

interface Pds {
  inviteCodeRequired?: boolean;
  version?: string;
  errorAt?: string;
}

const client = new Client({
  handler: simpleFetchHandler({ service: "https://public.api.bsky.app" }),
});

function isBlueskyHost(host: string): boolean {
  return /^(?:https?:\/\/)?(?:[^\/]+\.)?(?:bsky\.network|bsky\.app|bsky\.dev|bsky\.social)\/?$/.test(
    host,
  );
}

async function getAccountsOnPds(
  pds: string,
  cursor: string | undefined = undefined,
  accounts: didWithPds[] = [],
): Promise<didWithPds[]> {
  const url = `${pds}xrpc/com.atproto.sync.listRepos${cursor ? `?cursor=${cursor}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    console.log(`failed to retrieve accounts for ${pds}`);
    return [];
  }

  const data = await response.json();

  // only get at did's from the accounts, and propagate the pds and filter out
  // inactive accounts
  const accs: didWithPds[] = data.repos
    .map((acc: { did: string; active: boolean }) => {
      if (!acc.active) return null;
      return { did: acc.did, pds };
    })
    .filter((x: didWithPds | undefined) => x);

  accounts.push(...accs);

  if (data.cursor) {
    return await getAccountsOnPds(pds, data.cursor, accounts);
  }

  return accounts;
}

async function getProfiles(
  actorsWithPds: didWithPds[],
): Promise<profileWithPds[]> {
  const dids = actorsWithPds.map((acc) => acc.did);
  const didToPds = new Map(actorsWithPds.map((acc) => [acc.did, acc.pds]));

  const response = await client.get("app.bsky.actor.getProfiles", {
    params: { actors: dids },
  });

  if (!response.ok) return [];

  return response.data.profiles.map((profile) => ({
    ...profile,
    pds: didToPds.get(profile.did) || "",
  }));
}

async function fetchAllAccounts(pdses: string[], concurrency = 5) {
  const results: didWithPds[] = [];
  const queue = [...pdses];

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const pds = queue.pop();
      if (!pds) continue;
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

async function createPdsList(accounts: profileWithPds[]) {
  const pdses = new Map<string, { followers: number; accounts: number }>();
  for (const account of accounts) {
    if (pdses.has(account.pds)) {
      const data = pdses.get(account.pds);
      const totalFollows = data.followers + (account.followersCount || 0);
      const totalAccounts = data.accounts + 1;
      pdses.set(account.pds, {
        followers: totalFollows,
        accounts: totalAccounts,
      });
    } else {
      pdses.set(account.pds, {
        followers: account.followersCount || 0,
        accounts: 1,
      });
    }
  }

  // sort pdses by followers count
  const sortedPdses = new Map(
    [...pdses.entries()].sort((a, b) => b[1].followers - a[1].followers),
  );

  // convert map to array of objects
  const pdsesArray = Array.from(sortedPdses, ([pds, data]) => ({
    pds: pds.replace("https://", "").replace(/\/$/, ""),
    ...data,
    "followers to accounts ratio": Math.round(data.followers / data.accounts),
  }));

  fs.writeFileSync("data/pdses.json", JSON.stringify(pdsesArray));
}

// finally do the thing
async function main() {
  const data = fs.readFileSync("data/data.json", "utf8");
  const pdsMap: Map<string, Pds> = JSON.parse(data).pdses;

  const pdses: string[] = [];
  for (const [host, val] of Object.entries(pdsMap)) {
    // i don't want to count bsky accounts
    if (isBlueskyHost(host)) continue;

    // remove any failing pdses
    if (val.errorAt) continue;

    // this is massive and full of 0 follower andies
    if (
      host === "https://atproto.brid.gy/" ||
      host === "https://pds.si46.world/"
    )
      continue;

    pdses.push(host);
  }

  const accounts = await fetchAllAccounts(pdses, 5);

  const accountsToWrite: profileWithPds[] = [];
  for (let i = 0; i < accounts.length; i += 25) {
    const batch = accounts.slice(i, i + 25);
    const fetchedProfiles = await getProfiles(batch);
    accountsToWrite.push(...fetchedProfiles);
  }

  // sort the accounts by followers count
  accountsToWrite.sort(
    (a, b) => (b.followersCount || 0) - (a.followersCount || 0),
  );

  let output = "Rank | Handle | PDS | Followers\n----|------|-----|----------";

  for (const [i, account] of accountsToWrite.entries()) {
    output += `\n${i + 1} | ${account.handle} (${account.did}) | ${account.pds} | ${account.followersCount || 0}`;
  }

  fs.writeFileSync("data/accounts.md", output);
  fs.writeFileSync("data/accounts.json", JSON.stringify(accountsToWrite));

  createPdsList(accountsToWrite)
}

main();
