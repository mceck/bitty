import { Text, Box, useFocus, useInput } from "ink";
import { primary } from "../theme/style.js";
import { useEffect, useMemo, useState } from "react";
import clipboard from "clipboardy";
import chalk from "chalk";

type Props = {
  id?: string;
  placeholder?: string;
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onCopy?: (value: string) => void;
  isPassword?: boolean;
  showPasswordOnFocus?: boolean;
  isActive?: boolean;
  autoFocus?: boolean;
  inline?: boolean;
  multiline?: boolean;
};

export const TextInput = ({
  id,
  placeholder,
  value,
  isPassword,
  showPasswordOnFocus,
  isActive,
  autoFocus,
  inline,
  multiline,
  onChange,
  onSubmit,
  onCopy,
}: Props) => {
  const [cursor, setCursor] = useState(value.length);
  const { isFocused } = useFocus({ id, isActive, autoFocus });

  const displayValue = useMemo(() => {
    let displayValue = value;
    if (isPassword && (showPasswordOnFocus ? !isFocused : true)) {
      displayValue = "•".repeat(value.length);
    }
    displayValue = (displayValue?.length ? displayValue : placeholder) ?? "";
    if (isFocused) {
      let beforeCursor = displayValue.slice(0, cursor);
      let atCursor = displayValue.slice(cursor, cursor + 1) || " ";
      let afterCursor = displayValue.slice(cursor + 1);
      if (atCursor === "\n") {
        atCursor = " ";
        afterCursor = "\n" + afterCursor;
      }
      displayValue =
        beforeCursor +
        chalk.inverse(atCursor) +
        (afterCursor ? afterCursor : "");
    }
    return displayValue;
  }, [value, cursor, isFocused]);

  useEffect(() => {
    if (cursor > value.length) setCursor(value.length);
  }, [value]);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.meta && input === "c") {
      if (onCopy) {
        onCopy(value);
      } else {
        clipboard.writeSync(value);
      }
    } else if (key.backspace || (key.delete && value?.length && cursor > 0)) {
      onChange?.(value.slice(0, Math.max(0, cursor - 1)) + value.slice(cursor));
      setCursor(cursor - 1);
    } else if (key.ctrl && input === "e") {
      if (multiline) {
        const nextNewline = value.indexOf("\n", cursor);
        if (nextNewline !== -1) {
          setCursor(nextNewline);
          return;
        }
      }
      setCursor(value.length);
    } else if (key.ctrl && input === "a") {
      if (multiline) {
        const prevNewline = value.lastIndexOf("\n", Math.max(0, cursor - 1));
        if (prevNewline !== -1) {
          setCursor(prevNewline + 1);
          return;
        }
      }
      setCursor(0);
    } else if (key.leftArrow && cursor > 0) {
      setCursor(cursor - 1);
    } else if (key.rightArrow && cursor < value.length) {
      setCursor(cursor + 1);
    } else if (key.upArrow && multiline) {
      const prevNewline = value.lastIndexOf("\n", Math.max(0, cursor - 1));
      if (prevNewline !== -1) {
        const prevPrevNewline = value.lastIndexOf(
          "\n",
          Math.max(0, prevNewline - 1)
        );
        const col = cursor - prevNewline - 1;
        const lineLen =
          prevNewline - (prevPrevNewline === -1 ? 0 : prevPrevNewline + 1);
        console.log({ cursor, prevPrevNewline, prevNewline, col, lineLen });
        if (lineLen > col) {
          setCursor(prevNewline - lineLen + col);
          return;
        }
        setCursor(prevNewline + lineLen);
      } else {
        setCursor(0);
      }
    } else if (key.downArrow && multiline) {
      const nextNewline = value.indexOf("\n", cursor);
      let prevNewline = value.lastIndexOf("\n", Math.max(0, cursor - 1));
      const col = cursor - prevNewline - 1;
      if (nextNewline !== -1) {
        let endl = value.indexOf("\n", nextNewline + 1);
        if (endl === -1) endl = value.length;
        const lineLen = endl - nextNewline;
        if (lineLen > col) {
          setCursor(nextNewline + 1 + col);
        } else {
          setCursor(nextNewline + lineLen);
        }
      } else {
        setCursor(value.length);
      }
    } else if (key.return) {
      if (multiline) {
        onChange?.(value.slice(0, cursor) + "\n" + value.slice(cursor));
        setCursor(cursor + 1);
      } else {
        onSubmit?.();
      }
    } else if (input) {
      if (input.length) {
        onChange?.(value.slice(0, cursor) + input + value.slice(cursor));
        setCursor(cursor + input.length);
      }
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={isFocused ? primary : "gray"}
      borderBottom={!inline}
      borderTop={!inline}
      borderLeft={!inline}
      borderRight={!inline}
      flexGrow={1}
      paddingX={inline ? 0 : 1}
      overflow="hidden"
    >
      <Text color={value ? "white" : "gray"}>{displayValue}</Text>
    </Box>
  );
};
