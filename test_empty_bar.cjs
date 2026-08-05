const blessed = require('blessed');
const contrib = require('blessed-contrib');
const screen = blessed.screen();
const chartBox = contrib.bar({
  maxHeight: 0,
  width: 50,
  height: 20
});
screen.append(chartBox);
chartBox.setData({ titles: [], data: [] });
screen.render();
setTimeout(() => process.exit(0), 500);
