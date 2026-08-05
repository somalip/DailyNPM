import blessed from 'blessed';
import contrib from 'blessed-contrib';
const screen = blessed.screen();
const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });
const donutBox = grid.set(8, 10, 3, 2, contrib.donut, {
  label: ' HEALTH ',
  radius: 4,
  arcWidth: 2,
  remainColor: 'black',
  yPadding: 0,
});
donutBox.setData([{ percent: 100, label: 'SCORE', color: 'green' }]);
screen.render();
setTimeout(() => process.exit(0), 100);
