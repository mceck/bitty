import { Text, Box, useFocus, useInput, type DOMElement } from "ink";
import { ReactNode, useId, useRef, useState } from "react";
import { primary } from "../theme/style.js";
import { useMouseTarget } from "../hooks/use-mouse.js";

type Props = {
  isActive?: boolean;
  doubleConfirm?: boolean;
  autoFocus?: boolean;
  onClick: () => void;
  children: ReactNode;
} & React.ComponentProps<typeof Box>;

export const Button = ({
  isActive = true,
  doubleConfirm,
  onClick,
  children,
  autoFocus = false,
  ...props
}: Props) => {
  const generatedId = useId();
  const { isFocused } = useFocus({ id: generatedId, autoFocus: autoFocus });
  const [askConfirm, setAskConfirm] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const boxRef = useRef<DOMElement>(null);

  const handlePress = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (doubleConfirm && !askConfirm) {
      setAskConfirm(true);
      timeoutRef.current = setTimeout(() => setAskConfirm(false), 1000);
      return;
    }
    if (askConfirm) setAskConfirm(false);
    onClick();
  };

  useMouseTarget(generatedId, boxRef, { onClick: handlePress });

  useInput(
    (input, key) => {
      if (key.return) handlePress();
    },
    { isActive: isFocused && isActive }
  );

  return (
    <Box
      ref={boxRef}
      borderStyle="round"
      borderColor={isFocused && isActive ? primary : "gray"}
      alignItems="center"
      justifyContent="center"
      {...props}
    >
      <Text
        color={
          isFocused && isActive ? (askConfirm ? "yellow" : "white") : "gray"
        }
      >
        {askConfirm ? "Confirm?" : children}
      </Text>
    </Box>
  );
};
