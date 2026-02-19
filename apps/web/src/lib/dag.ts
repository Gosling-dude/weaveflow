type Edge = { source: string; target: string };

export function topologicalSort(nodeIds: string[], edges: Edge[]) {
  const indegree = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  const outgoing = new Map<string, string[]>(nodeIds.map((nodeId) => [nodeId, []]));

  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const queue = nodeIds.filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of outgoing.get(current) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if ((indegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }

  return {
    hasCycle: order.length !== nodeIds.length,
    order,
  };
}