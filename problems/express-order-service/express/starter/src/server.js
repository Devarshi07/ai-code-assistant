const {createApp} = require('./app');

const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => {
  console.log(`Corner Pantry orders API listening on http://localhost:${port}`);
});
