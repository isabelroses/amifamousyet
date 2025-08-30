## Am I Famous Yet?

Some simple atproto scripts to check if you're famous yet, or better yet your PDS is famous yet.

### Running the script

There are two main scripts here:

#### The fetcher

The fetcher is the most important part here. It takes about 10 minutes to get
all the data from the none bsky pdses and then processes it into a 2 massive
json file.

To run the fetcher, run the following command:

```bash
pnpm run gen
```

This will generate the `data/accounts.json` and `data/pdses.json` files.

The `data/accounts.json` file contains all the accounts, their follower count,
and their pds and any other information collected related to the account.

The `data/pdses.json` file contains all the pdses, their accumulated follower
count, the number of accounts on the pds, and the ratio of followers to
accounts.

#### The site

The site is a simple static stite that displays all the data from the fetcher.

To run the site, run the following command:

```bash
pnpm run site
```

This is really a build command, it will generate the site in the `dist` folder.

There is already an instance of the site running at <https://isabelroses.github.io/amifamousyet>
