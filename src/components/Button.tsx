import { Text, Box, useFocus, useInput } from "ink";
import { ReactNode } from "react";
import { primary } from "../theme/style.js";

type Props = {
  isActive?: boolean;
  onClick: () => void;
  children: ReactNode;
} & React.ComponentProps<typeof Box>;

export const Button = ({
  isActive = true,
  onClick,
  children,
  ...props
}: Props) => {
  const { isFocused } = useFocus();

  useInput((input, key) => {
    if (!isFocused || !isActive) return;

    if (key.return) {
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
      <Text color={isFocused && isActive ? "white" : "gray"}>{children}</Text>
    </Box>
  );
};
