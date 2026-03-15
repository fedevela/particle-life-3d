export function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function nextRandomFromState(state: number) {
  let nextState = state;
  nextState ^= nextState << 13;
  nextState ^= nextState >>> 17;
  nextState ^= nextState << 5;
  nextState >>>= 0;
  return {
    nextState,
    value: nextState / 4294967296,
  };
}
