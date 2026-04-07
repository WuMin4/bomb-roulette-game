import fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const fixed = content.replace(/icon: '.*'/g, "icon: '🔍'");
fs.writeFileSync('src/App.tsx', fixed);
