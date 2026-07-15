import { useState, useRef } from "react";

export function useToast() {
  const [toast, setToast] = useState({ msg: "", err: false });
  const timer = useRef(null);
  const show = (msg, isErr = false) => {
    setToast({ msg, err: isErr });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast({ msg: "", err: false }), 2400);
  };
  return [toast, show];
}
