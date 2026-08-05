const blessed = require('blessed');
const screen = blessed.screen({ smartCSR: true });
const prompt = blessed.prompt({ parent: screen, hidden: true });
screen.key(['s'], () => {
  prompt.input('Enter pkg:', '', (err, val) => {
    screen.destroy();
    console.log("Searched for:", val);
  });
});
setTimeout(() => {
  screen.destroy();
  console.log("Timeout");
}, 1000);
