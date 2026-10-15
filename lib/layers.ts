/**
 * Tracks stacked overlays (sheets, the camera) so keyboard handling such as
 * Escape and the Tab focus trap only applies to the one on top.
 */
const stack: symbol[] = [];

export function pushLayer() {
  const token = Symbol("layer");
  stack.push(token);
  return {
    isTop: () => stack[stack.length - 1] === token,
    release: () => {
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
    },
  };
}
