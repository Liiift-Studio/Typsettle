// Empty React stub for the capture harness only. dist/index.js bundles the
// React hook + component alongside the framework-agnostic core; the capture
// exercises only the core (applySettle/getCleanHTML), so these named exports
// just need to exist as no-ops to satisfy the module graph.
export const useRef = () => ({ current: null });
export const useCallback = (fn) => fn;
export const useEffect = () => {};
export const useLayoutEffect = () => {};
export const forwardRef = (fn) => fn;
export const jsx = () => null;
export const jsxs = () => null;
export const Fragment = Symbol("Fragment");
export default {};
