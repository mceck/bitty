import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  type DOMElement,
  useStdin,
  useFocusManager,
  measureElement,
} from "ink";

type TargetOptions = {
  noFocus?: boolean;
  onClick?: (relX: number, relY: number) => void;
};

type TargetEntry = {
  ref: React.RefObject<DOMElement | null>;
} & TargetOptions;

type MouseContextType = {
  registerTarget: (
    id: string,
    ref: React.RefObject<DOMElement | null>,
    options?: TargetOptions
  ) => void;
  unregisterTarget: (id: string) => void;
  subscribe: (listener: (targetId: string) => void) => () => void;
};

const MouseContext = createContext<MouseContextType>({
  registerTarget: () => {},
  unregisterTarget: () => {},
  subscribe: () => () => {},
});

const mouseSequenceRe = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;

function getAbsolutePosition(node: DOMElement) {
  let currentNode: DOMElement | undefined = node;
  let x = 0;
  let y = 0;
  while (currentNode?.parentNode) {
    if (!currentNode.yogaNode) return undefined;
    x += currentNode.yogaNode.getComputedLeft();
    y += currentNode.yogaNode.getComputedTop();
    currentNode = currentNode.parentNode;
  }
  return { x, y };
}

export const MouseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { internal_eventEmitter } = useStdin();
  const { focus } = useFocusManager();
  const targetsRef = useRef<Map<string, TargetEntry>>(new Map());
  const listenersRef = useRef<Set<(id: string) => void>>(new Set());
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const registerTarget = useCallback(
    (
      id: string,
      ref: React.RefObject<DOMElement | null>,
      options?: TargetOptions
    ) => {
      targetsRef.current.set(id, { ref, ...options });
    },
    []
  );

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const subscribe = useCallback(
    (listener: (targetId: string) => void) => {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
    []
  );

  const handleClick = useCallback((x: number, y: number) => {
    for (const [id, target] of targetsRef.current) {
      const node = target.ref.current;
      if (!node) continue;

      const pos = getAbsolutePosition(node);
      if (!pos) continue;

      const { width, height } = measureElement(node);

      if (
        x >= pos.x &&
        x < pos.x + width &&
        y >= pos.y &&
        y < pos.y + height
      ) {
        for (const listener of listenersRef.current) {
          listener(id);
        }
        if (!target.noFocus) {
          focusRef.current(id);
        }
        target.onClick?.(x - pos.x, y - pos.y);
        return;
      }
    }
  }, []);

  const handleClickRef = useRef(handleClick);
  handleClickRef.current = handleClick;

  useEffect(() => {
    if (!internal_eventEmitter) return;

    // Enable SGR mouse tracking mode
    process.stdout.write("\x1b[?1000h\x1b[?1006h");

    // Patch event emitter to intercept mouse sequences
    const originalEmit = internal_eventEmitter.emit.bind(
      internal_eventEmitter
    );

    internal_eventEmitter.emit = (
      event: string | symbol,
      ...args: unknown[]
    ): boolean => {
      if (event === "input") {
        const data = args[0] as string;
        const match = mouseSequenceRe.exec(data);
        if (match) {
          const button = parseInt(match[1]!, 10);
          const x = parseInt(match[2]!, 10) - 1;
          const y = parseInt(match[3]!, 10) - 1;
          const isPress = match[4] === "M";

          if (isPress && (button & 3) === 0) {
            handleClickRef.current(x, y);
          }

          return true;
        }
      }
      return originalEmit(event, ...args);
    };

    const disableMouse = () => {
      process.stdout.write("\x1b[?1006l\x1b[?1000l");
    };

    process.on("exit", disableMouse);

    return () => {
      internal_eventEmitter.emit = originalEmit;
      disableMouse();
      process.removeListener("exit", disableMouse);
    };
  }, [internal_eventEmitter]);

  return (
    <MouseContext.Provider
      value={{ registerTarget, unregisterTarget, subscribe }}
    >
      {children}
    </MouseContext.Provider>
  );
};

export const useMouseTarget = (
  id: string,
  ref: React.RefObject<DOMElement | null>,
  options?: TargetOptions
) => {
  const { registerTarget, unregisterTarget } = useContext(MouseContext);
  const onClickRef = useRef(options?.onClick);
  onClickRef.current = options?.onClick;

  useEffect(() => {
    registerTarget(id, ref, {
      noFocus: options?.noFocus,
      onClick: (x, y) => onClickRef.current?.(x, y),
    });
    return () => unregisterTarget(id);
  }, [id, ref, registerTarget, unregisterTarget, options?.noFocus]);
};

export const useMouseSubscribe = (
  listener: (targetId: string) => void
) => {
  const { subscribe } = useContext(MouseContext);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const stableListener = (id: string) => listenerRef.current(id);
    return subscribe(stableListener);
  }, [subscribe]);
};
