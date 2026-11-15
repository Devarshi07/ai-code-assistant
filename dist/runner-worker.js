// Dedicated worker that executes candidate JavaScript away from the page.
// The server sends this script with a CSP that blocks all network access.
import {runProject} from './runner-core.js';

self.onmessage = async ({data}) => {
  try {
    await runProject(data, event => self.postMessage(event));
  } catch (error) {
    self.postMessage({type: 'log', stream: 'stderr', text: `Runner error: ${error?.message || error}\n`});
    self.postMessage({type: 'done', mode: data.mode, exitCode: 1, failed: 1, passed: 0, ms: 0});
  }
};
