import blessed from 'blessed';
import contrib from 'blessed-contrib';

const screen = blessed.screen();
const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

const sparklineBox = grid.set(0, 0, 12, 12, contrib.sparkline, {
  label: ' 📈 30D TREND ',
  tags: true,
  border: { type: 'line' },
  style: { fg: 'green', border: { fg: 'green' }, label: { fg: 'green', bold: true } },
});

sparklineBox.setData(
  ['Downloads'],
  [[10, 20, 30, 40, 50, 40, 30, 20, 10, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10]]
);

screen.render();
setTimeout(() => {
  screen.destroy();
}, 500);
