import { Box, Text, useInput, useStdout } from "ink";
import { useState } from "react";
import { primary } from "../theme/style.js";
import {
  DEFAULT_KEYBINDINGS,
  KEYBINDING_LABELS,
  KEYBINDING_ORDER,
  type KeybindingId,
  captureBinding,
  displayBinding,
  useKeybindings,
} from "../hooks/keybindings.js";

type Props = {
  onClose: () => void;
};

export function KeybindingsView({ onClose }: Props) {
  const { keybindings, updateKeybindings } = useKeybindings();
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [capturingId, setCapturingId] = useState<KeybindingId | null>(null);
  const [justReset, setJustReset] = useState(false);

  // Total items: all bindings + "Reset to defaults" row
  const totalItems = KEYBINDING_ORDER.length + 1;
  const isResetSelected = selectedIndex === KEYBINDING_ORDER.length;

  // How many list rows can fit on screen (leave room for header, hints, reset row)
  const maxVisible = Math.max(stdout.rows - 10, 5);
  const [offset, setOffset] = useState(0);

  useInput(async (input, key) => {
    if (capturing) {
      // Bare Escape cancels capture without saving
      if (key.escape && !key.ctrl && !key.shift && !key.meta) {
        setCapturing(false);
        setCapturingId(null);
        return;
      }
      const binding = captureBinding(input, key);
      if (binding && capturingId) {
        await updateKeybindings({ ...keybindings, [capturingId]: binding });
        setCapturing(false);
        setCapturingId(null);
      }
      return;
    }

    if (key.upArrow) {
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);
      if (newIndex < offset) setOffset(newIndex);
      return;
    }

    if (key.downArrow) {
      const newIndex = Math.min(totalItems - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);
      if (newIndex >= offset + maxVisible) setOffset(newIndex - maxVisible + 1);
      return;
    }

    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      if (isResetSelected) {
        await updateKeybindings({ ...DEFAULT_KEYBINDINGS });
        setJustReset(true);
        setTimeout(() => setJustReset(false), 1500);
        return;
      }
      const id = KEYBINDING_ORDER[selectedIndex];
      if (id) {
        setCapturingId(id);
        setCapturing(true);
      }
    }
  });

  const visibleBindings = KEYBINDING_ORDER.slice(offset, offset + maxVisible);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={primary}
      paddingX={2}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={primary}>
          Keybindings
        </Text>
      </Box>

      {/* Hint bar */}
      <Box marginBottom={1}>
        <Text color="#9f9f9f">
          <Text bold>↑/↓</Text>
          {" Navigate  "}
          <Text bold>Enter</Text>
          {" Edit  "}
          <Text bold>Esc</Text>
          {" Close"}
        </Text>
      </Box>

      {/* Column headers */}
      <Box paddingX={1} marginBottom={1}>
        <Box width={36}>
          <Text color="#9f9f9f" bold>
            Action
          </Text>
        </Box>
        <Text color="#9f9f9f" bold>
          Binding
        </Text>
      </Box>

      {/* Keybinding rows */}
      {visibleBindings.map((id, visibleIdx) => {
        const actualIndex = visibleIdx + offset;
        const isSelected = selectedIndex === actualIndex;
        const isEditing = capturing && capturingId === id;
        const binding = keybindings[id];

        return (
          <Box key={id} paddingX={1}>
            <Box width={2} flexShrink={0}>
              <Text color={isSelected ? primary : "#9f9f9f"}>
                {isSelected ? "▶" : " "}
              </Text>
            </Box>
            <Box width={34} flexShrink={0}>
              <Text color={isSelected ? "white" : "default"} wrap="truncate">
                {KEYBINDING_LABELS[id]}
              </Text>
            </Box>
            <Text
              color={isEditing ? "yellow" : isSelected ? primary : "#9f9f9f"}
            >
              {isEditing ? "Press new key..." : displayBinding(binding)}
            </Text>
          </Box>
        );
      })}

      {/* Scroll indicator when list is truncated */}
      {KEYBINDING_ORDER.length > maxVisible && (
        <Box paddingX={3}>
          <Text color="#9f9f9f">
            {offset + maxVisible < KEYBINDING_ORDER.length ? "▼ more" : ""}
          </Text>
        </Box>
      )}

      {/* Reset to defaults row — shown only when at bottom of visible range */}
      {selectedIndex >= offset + maxVisible - 1 ||
      isResetSelected ||
      KEYBINDING_ORDER.length <= maxVisible ? (
        <Box paddingX={1} marginTop={1}>
          <Box width={2} flexShrink={0}>
            <Text color={isResetSelected ? primary : "#9f9f9f"}>
              {isResetSelected ? "▶" : " "}
            </Text>
          </Box>
          <Text color={isResetSelected ? "white" : "#9f9f9f"}>
            {justReset ? "Reset done!" : "Reset to defaults"}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
