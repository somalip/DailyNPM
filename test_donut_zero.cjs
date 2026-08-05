const blessed = require('blessed');
const contrib = require('blessed-contrib');
const screen = blessed.screen();
const donut = contrib.donut({
  radius: 8,
  arcWidth: 3,
  width: 50,
  height: 20
});
screen.append(donut);
donut.setData([
  { percent: 100, label: 'Health', color: 'green' },
  { percent: 0, label: '', color: 'black' }
]);
screen.render();
setTimeout(() => process.exit(0), 500);
