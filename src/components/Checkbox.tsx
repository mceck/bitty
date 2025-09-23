import { Text, Box, useFocus, useInput } from "ink";
import { primary } from "../theme/style.js";

type Props = {
  isActive?: boolean;
  label?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
} & React.ComponentProps<typeof Box>;

export const Checkbox = ({
  isActive = true,
  value,
  label,
  onToggle,
  ...props
}: Props) => {
  const { isFocused } = useFocus();

  useInput(
    (input, key) => {
      if (input === " ") {
        onToggle(!value);
      }
    },
    { isActive: isFocused && isActive }
  );

  return (
    <Box {...props}>
      <Box
        width={5}
        height={3}
        flexShrink={0}
        borderStyle="round"
        borderColor={isFocused && isActive ? primary : "gray"}
      >
        {value && (
          <Box width={1} height={1} marginLeft={1}>
            <Text color={isFocused && isActive ? primary : "gray"}>X</Text>
          </Box>
        )}
      </Box>
      <Box marginTop={1} marginLeft={1}>
        <Text>{label}</Text>
      </Box>
    </Box>
  );
};
