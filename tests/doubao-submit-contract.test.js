import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { doubaoSubmitAdapter } from '../content-scripts/src/providers/doubao/adapter.js';
import { runSubmitAdapterContract } from './contracts/submit-adapter-contract.js';

const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'doubao');

runSubmitAdapterContract({
  provider: 'doubao',
  adapter: doubaoSubmitAdapter,
  loadFixture: fixtureName =>
    readFileSync(join(fixtureRoot, fixtureName), 'utf8')
});
