import { Text, Box, useFocus, useInput } from "ink";
import { ReactNode, useRef, useState } from "react";
import { primary } from "../theme/style.js";

type Props = {
  isActive?: boolean;
  doubleConfirm?: boolean;
  onClick: () => void;
  children: ReactNode;
} & React.ComponentProps<typeof Box>;

export const Button = ({
  isActive = true,
  doubleConfirm,
  onClick,
  children,
  ...props
}: Props) => {
  const { isFocused } = useFocus();
  const [askConfirm, setAskConfirm] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useInput((input, key) => {
    if (!isFocused || !isActive) return;

    if (key.return) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (doubleConfirm && !askConfirm) {
        setAskConfirm(true);
        timeoutRef.current = setTimeout(() => setAskConfirm(false), 1000);
        return;
      }
      if (askConfirm) setAskConfirm(false);
      onClick();
    }
  });

  return (
    <Box
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
