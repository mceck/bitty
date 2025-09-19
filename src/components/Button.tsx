import { Text, Box, useFocus, useInput } from "ink";
import { ReactNode } from "react";
import { primary } from "../theme/style.js";

type Props = {
  onClick: () => void;
  children: ReactNode;
};

export const Button = ({ onClick, children }: Props) => {
  const { isFocused } = useFocus();

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.return) {
      onClick();
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={isFocused ? primary : "gray"}
      alignItems="center"
      justifyContent="center"
    >
      <Text color={isFocused ? "white" : "gray"}>{children}</Text>
    </Box>
  );
};
