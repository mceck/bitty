import { Text, Box, useFocus, useInput, type DOMElement } from "ink";
import { ReactNode, useId, useRef, useState } from "react";
import { primary } from "../theme/style.js";
import { useMouseTarget } from "../hooks/use-mouse.js";

type Props = {
  isActive?: boolean;
  doubleConfirm?: boolean;
  tripleConfirm?: boolean;
  autoFocus?: boolean;
  onClick: () => void;
  children: ReactNode;
} & React.ComponentProps<typeof Box>;

export const Button = ({
  isActive = true,
  doubleConfirm,
  tripleConfirm,
  onClick,
  children,
  autoFocus = false,
  ...props
}: Props) => {
  const generatedId = useId();
  const { isFocused } = useFocus({ id: generatedId, autoFocus: autoFocus });
  const [askConfirm, setAskConfirm] = useState(false);
  const [ask2Confirm, setAsk2Confirm] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const boxRef = useRef<DOMElement>(null);

  const handlePress = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if ((doubleConfirm || tripleConfirm) && !askConfirm) {
      setAskConfirm(true);
      timeoutRef.current = setTimeout(() => setAskConfirm(false), 1000);
      return;
    }
    if (tripleConfirm && !ask2Confirm) {
      setAsk2Confirm(true);
      timeoutRef.current = setTimeout(() => {
        setAskConfirm(false);
        setAsk2Confirm(false);
      }, 1000);
      return;
    }
    if (askConfirm) setAskConfirm(false);
    if (ask2Confirm) setAsk2Confirm(false);
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
          isFocused && isActive
            ? ask2Confirm
              ? "red"
              : askConfirm
              ? "yellow"
              : "white"
            : "gray"
        }
      >
        {ask2Confirm ? "Are you sure?" : askConfirm ? "Confirm?" : children}
      </Text>
    </Box>
  );
};
