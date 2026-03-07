import { Box, Text, useInput, useStdout } from "ink";
import { Cipher, Collection } from "../../clients/bw.js";
import { primaryLight } from "../../theme/style.js";
import { useState } from "react";

export function CollectionsTab({
  isFocused,
  selectedCipher,
  collections,
  onChange,
}: {
  isFocused: boolean;
  selectedCipher: Cipher;
  collections: Collection[];
  onChange: (cipher: Cipher) => void;
}) {
  const { stdout } = useStdout();
  const [cursor, setCursor] = useState(0);
  const selected = selectedCipher.collectionIds ?? [];

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
      } else if (key.downArrow) {
        setCursor((c) => Math.min(collections.length - 1, c + 1));
      } else if (_input === " ") {
        const col = collections[cursor];
        if (!col) return;
        const has = selected.includes(col.id);
        const newIds = has
          ? selected.filter((id) => id !== col.id)
          : [...selected, col.id];
        onChange({ ...selectedCipher, collectionIds: newIds });
      }
    },
    { isActive: isFocused }
  );

  if (!collections.length) {
    return (
      <Box flexDirection="column" height={stdout.rows - 18}>
        <Text color="gray">No writable collections available.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={0} height={stdout.rows - 18}>
      {collections.map((col, idx) => {
        const checked = selected.includes(col.id);
        const isCursor = cursor === idx && isFocused;
        return (
          <Box key={col.id} flexDirection="row">
            <Text
              color={isCursor ? primaryLight : "gray"}
              bold={isCursor}
            >
              {checked ? "[x] " : "[ ] "}
            </Text>
            <Text color={isCursor ? "white" : checked ? primaryLight : "gray"}>
              {col.name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
