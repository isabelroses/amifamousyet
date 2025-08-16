import fs from 'fs';

let md = fs.readFileSync('dist/accounts.txt', 'utf8');
let lines = md.trim().split('\n');

let header = lines[0];
let separator = lines[1];
let rows = lines.slice(2);

let filtered = rows
    .filter(row => {
        let val = row.split('|').pop().trim();
        return val !== 'undefined';
    })
    .map((row, idx) => {
        let cols = row.split('|').map(c => c.trim()).filter(c => c !== '');
        return '| ' + [String(idx + 1), ...cols].join(' | ') + ' |';
    });

let headerCols = header.split('|').map(c => c.trim()).filter(c => c !== '');
header = '| ' + ['Rank', ...headerCols].join(' | ') + ' |';

let sepCols = separator.split('|').map(c => c.trim()).filter(c => c !== '');
separator = '| ' + ['---', ...sepCols].join(' | ') + ' |';

let output = [header, separator, ...filtered].join('\n');
fs.writeFileSync('dist/numbered.md', output);

