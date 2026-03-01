import { Text, Box, useFocus, useInput, type DOMElement } from "ink";
import { useId, useRef } from "react";
import { primary } from "../theme/style.js";
import { useMouseTarget } from "../hooks/use-mouse.js";

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
  const generatedId = useId();
  const { isFocused } = useFocus({ id: generatedId });
  const boxRef = useRef<DOMElement>(null);
  useMouseTarget(generatedId, boxRef, {
    onClick: () => onToggle(!value),
  });

  useInput(
    (input, key) => {
      if (input === " ") {
        onToggle(!value);
      }
    },
    { isActive: isFocused && isActive }
  );

  return (
    <Box ref={boxRef} {...props}>
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
