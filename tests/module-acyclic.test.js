import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

function buildModuleGraph(moduleDir) {
  const files = readdirSync(moduleDir).filter(file => file.endsWith('.js'));
  const fileSet = new Set(files);
  const graph = new Map();

  for (const file of files) {
    const source = readFileSync(resolve(moduleDir, file), 'utf8');
    const deps = [...source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]\.\/([^'"]+\.js)['"]/g)]
      .map(match => basename(match[1]))
      .filter(dep => fileSet.has(dep));
    graph.set(file, deps);
  }

  return graph;
}

function findStaticImportCycles(graph) {
  const cycles = [];
  const stack = [];
  const visited = new Set();

  function visit(node) {
    const stackIndex = stack.indexOf(node);
    if (stackIndex >= 0) {
      cycles.push([...stack.slice(stackIndex), node]);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.push(node);
    for (const dep of graph.get(node) || []) {
      visit(dep);
    }
    stack.pop();
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return cycles;
}

describe('aichatmerge-panel module graph', () => {
  it('has no static import cycles inside modules/', () => {
    const moduleDir = resolve(process.cwd(), 'aichatmerge-panel/modules');
    const graph = buildModuleGraph(moduleDir);
    expect(findStaticImportCycles(graph)).toEqual([]);
  });
});
