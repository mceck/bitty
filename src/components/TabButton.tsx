import { Text, Box, type DOMElement } from "ink";
import { ReactNode, useId, useRef } from "react";
import { primary } from "../theme/style.js";
import { useMouseTarget } from "../hooks/use-mouse.js";

type Props = {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  borderLess?: boolean;
};

export const TabButton = ({ active, onClick, children, borderLess }: Props) => {
  const id = useId();
  const boxRef = useRef<DOMElement>(null);
  useMouseTarget(id, boxRef, { onClick });

  return (
    <Box
      ref={boxRef}
      borderStyle={borderLess ? undefined : "round"}
      borderColor={active ? primary : "#9f9f9f"}
      alignItems="center"
      justifyContent="center"
      paddingX={1}
    >
      <Text color={active ? "white" : "#9f9f9f"}>{children}</Text>
    </Box>
  );
};
