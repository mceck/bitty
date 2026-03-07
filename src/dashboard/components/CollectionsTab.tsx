import { Box, Text, useInput, useStdout } from "ink";
import { Cipher, Collection } from "../../clients/bw.js";
import { useId, useRef, useState } from "react";
import { useMouseTarget } from "../../hooks/use-mouse.js";

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
      }
    },
    { isActive: isFocused },
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
          <CollectionCheckbox
            key={col.id}
            col={col}
            isCursor={isCursor}
            checked={checked}
            onFocus={() => setCursor(idx)}
            onChange={(checked) =>
              onChange({
                ...selectedCipher,
                collectionIds: checked
                  ? [...selected, col.id]
                  : selected.filter((id) => id !== col.id),
              })
            }
          />
        );
      })}
    </Box>
  );

  function CollectionCheckbox({
    col,
    isCursor,
    checked,
    onChange,
    onFocus,
  }: {
    col: Collection;
    isCursor: boolean;
    checked: boolean;
    onChange?: (checked: boolean) => void;
    onFocus?: () => void;
  }) {
    const checkRef = useRef(null);
    const labelRef = useRef(null);
    const checkId = useId();
    const labelId = useId();

    useMouseTarget(checkId, checkRef, {
      onClick: () => onChange?.(!checked),
    });

    useMouseTarget(labelId, labelRef, {
      onClick: () => onFocus?.(),
    });

    useInput(
      (input) => {
        if (input === " ") {
          onChange?.(!checked);
        }
      },
      { isActive: isCursor },
    );
    return (
      <Box key={col.id} flexDirection="row">
        <Box ref={checkRef}>
          <Text color={isCursor ? "white" : "gray"} bold={isCursor}>
            {checked ? "[x] " : "[ ] "}
          </Text>
        </Box>
        <Box ref={labelRef}>
          <Text color={isCursor ? "white" : "gray"}>
            {col.name}
          </Text>
        </Box>
      </Box>
    );
  }
}
