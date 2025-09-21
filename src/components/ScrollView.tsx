import { Box, useInput } from "ink";
import { ReactNode, useEffect, useState } from "react";

export const ScrollView = <T,>({
  count,
  list,
  isActive,
  selectedIndex,
  onSelect,
  onSubmit,
  children,
}: {
  count: number;
  list: T[];
  isActive: boolean;
  selectedIndex: number;
  onSelect?: (position: number) => void;
  onSubmit?: (position: number) => void;
  children: (arg: { el: T; index: number; selected: boolean }) => ReactNode;
}) => {
  const [offset, setOffset] = useState(0);
  useInput((input, key) => {
    if (!isActive) return;
    if (key.upArrow) {
      if (selectedIndex === offset && offset > 0) {
        setOffset(Math.max(0, offset - 1));
      }
      const newIndex = Math.max(0, selectedIndex - 1);
      onSelect?.(newIndex);
    } else if (key.downArrow) {
      if (
        selectedIndex === offset + count - 1 &&
        offset + count < list.length
      ) {
        setOffset(Math.min(list.length - count, offset + 1));
      }
      const newIndex = Math.min(list.length - 1, selectedIndex + 1);
      onSelect?.(newIndex);
    } else if (key.return) {
      onSubmit?.(selectedIndex);
    }
  });

  useEffect(() => {
    if (selectedIndex < offset) setOffset(selectedIndex);
  }, [selectedIndex]);

  return (
    <Box flexDirection="column" overflow="hidden">
      {list.slice(offset, offset + count).map((el, index) =>
        children({
          el,
          index: index + offset,
          selected: selectedIndex === index + offset,
        })
      )}
    </Box>
  );
};
