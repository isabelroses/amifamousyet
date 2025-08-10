import fs from 'fs';

let md = fs.readFileSync('dist/accounts.txt', 'utf8');
let lines = md.trim().split('\n');

let header = lines[0];
let separator = lines[1];
let rows = lines.slice(2);

rows.sort((a, b) => {
    let aVal = a.split('|').pop().trim();
    let bVal = b.split('|').pop().trim();

    let aNum = aVal === 'undefined' ? NaN : parseInt(aVal, 10);
    let bNum = bVal === 'undefined' ? NaN : parseInt(bVal, 10);

    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return bNum - aNum; // reverse order
});

let output = [header, separator, ...rows].join('\n');
fs.writeFileSync('dist/file.txt', output);

