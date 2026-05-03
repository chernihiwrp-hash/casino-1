import { useEffect, useState } from "react";

let _locked = false;
const listeners = new Set<(v: boolean) => void>();

export function setNavLocked(v: boolean) {
  _locked = v;
  listeners.forEach((l) => l(v));
}

export function isNavLocked() {
  return _locked;
}

export function useNavLocked() {
  const [v, setV] = useState(_locked);
  useEffect(() => {
    listeners.add(setV);
    setV(_locked);
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}
