import { Text, Box, useFocus, useInput, useFocusManager } from "ink";
import { primary } from "../theme/style.js";
import { useEffect, useMemo, useState } from "react";
import clipboard from "clipboardy";
import chalk from "chalk";
import { useStatusMessage } from "../hooks/status-message.js";

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
  maxLines?: number;
} & React.ComponentProps<typeof Box>;

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
  maxLines = 1,
  onChange,
  onSubmit,
  onCopy,
  ...props
}: Props) => {
  const [cursor, setCursor] = useState(onChange ? value.length : 0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { isFocused } = useFocus({ id, isActive, autoFocus });
  const { showStatusMessage } = useStatusMessage();
  const { focusNext } = useFocusManager();

  const displayValue = useMemo(() => {
    let displayValue = value;
    if (isPassword && (showPasswordOnFocus ? !isFocused : true)) {
      displayValue = "•".repeat(value.length);
    }
    displayValue = (displayValue?.length ? displayValue : placeholder) ?? "";

    if (multiline && maxLines > 0) {
      const lines = displayValue.split("\n");
      const currentLine =
        displayValue.substring(0, cursor).split("\n").length - 1;

      if (currentLine < scrollOffset) {
        setScrollOffset(currentLine);
      } else if (currentLine >= scrollOffset + maxLines) {
        setScrollOffset(currentLine - maxLines + 1);
      }

      displayValue = lines
        .slice(scrollOffset, scrollOffset + maxLines)
        .join("\n");
    }

    if (isFocused) {
      let visibleCursor = cursor;
      if (multiline && maxLines > 0) {
        const lines = value.split("\n");
        const cursorLineIndex =
          value.substring(0, cursor).split("\n").length - 1;

        if (
          cursorLineIndex >= scrollOffset &&
          cursorLineIndex < scrollOffset + maxLines
        ) {
          const visibleStart = lines
            .slice(0, scrollOffset)
            .reduce((acc, line) => acc + line.length + 1, 0);

          visibleCursor = cursor - visibleStart;
        } else {
          visibleCursor = 0;
        }
      }

      let beforeCursor = displayValue.slice(0, visibleCursor);
      let atCursor =
        displayValue.slice(visibleCursor, visibleCursor + 1) || " ";
      let afterCursor = displayValue.slice(visibleCursor + 1);

      if (atCursor === "\n") {
        atCursor = " ";
        afterCursor = "\n" + afterCursor;
      }

      displayValue =
        beforeCursor +
        chalk.inverse(atCursor) +
        (afterCursor ? afterCursor : "");
    }
    if (!displayValue.length) {
      displayValue = " ";
    }
    return displayValue;
  }, [value, cursor, isFocused]);

  useEffect(() => {
    if (cursor > value.length) setCursor(value.length);

    if (multiline && maxLines > 0) {
      const currentLine = value.substring(0, cursor).split("\n").length - 1;
      if (currentLine < scrollOffset) {
        setScrollOffset(currentLine);
      } else if (currentLine >= scrollOffset + maxLines) {
        setScrollOffset(currentLine - maxLines + 1);
      }
    }
  }, [value, cursor, multiline, maxLines]);

  useInput(
    (input, key) => {
      if (key.ctrl && input === "y") {
        if (onCopy) {
          onCopy(value);
        } else {
          clipboard.writeSync(value);
          showStatusMessage("📋 Copied to clipboard!", "success");
        }
      } else if (key.backspace || (key.delete && value?.length && cursor > 0)) {
        onChange?.(
          value.slice(0, Math.max(0, cursor - 1)) + value.slice(cursor)
        );
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
        const lines = value.split("\n");
        const currentLine = value.substring(0, cursor).split("\n").length - 1;
        const currentLineStart =
          currentLine > 0
            ? lines.slice(0, currentLine).join("\n").length + 1
            : 0;
        const currentCol = cursor - currentLineStart;

        if (currentLine > 0) {
          const targetLine = currentLine - 1;
          const targetLineStart =
            targetLine > 0
              ? lines.slice(0, targetLine).join("\n").length + 1
              : 0;
          const targetLineLength = lines[targetLine]?.length ?? 0;

          if (currentLine <= scrollOffset) {
            setScrollOffset(Math.max(0, scrollOffset - 1));
          }

          const newCol = Math.min(currentCol, targetLineLength);
          setCursor(targetLineStart + newCol);
        } else {
          setCursor(0);
        }
      } else if (key.downArrow && multiline) {
        const lines = value.split("\n");
        const currentLine = value.substring(0, cursor).split("\n").length - 1;
        const currentLineStart =
          currentLine > 0
            ? lines.slice(0, currentLine).join("\n").length + 1
            : 0;
        const currentCol = cursor - currentLineStart;

        if (currentLine < lines.length - 1) {
          const targetLine = currentLine + 1;
          const targetLineStart =
            lines.slice(0, targetLine).join("\n").length + 1;
          const targetLineLength = lines[targetLine]?.length ?? 0;

          if (currentLine >= scrollOffset + maxLines - 1) {
            setScrollOffset(scrollOffset + 1);
          }

          const newCol = Math.min(currentCol, targetLineLength);
          setCursor(targetLineStart + newCol);
        } else {
          setCursor(value.length);
        }
      } else if (key.return) {
        if (multiline && cursor > 0 && value[cursor - 1] === "\\") {
          const newValue =
            value.slice(0, cursor - 1) + "\n" + value.slice(cursor);
          const newCurrentLine =
            newValue.substring(0, cursor).split("\n").length - 1;

          if (newCurrentLine >= scrollOffset + maxLines) {
            setScrollOffset(newCurrentLine - maxLines + 1);
          }

          onChange?.(newValue);
        } else {
          if (onSubmit) onSubmit();
          else focusNext();
        }
      } else if (input) {
        if (multiline) {
          input = input.replaceAll(/[\r\n]/g, "\n");
        } else {
          input = input.replaceAll(/[^\x20-\x7E]/g, "");
        }
        if (input.length) {
          onChange?.(value.slice(0, cursor) + input + value.slice(cursor));
          setCursor(cursor + input.length);
        }
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box
      borderStyle="round"
      borderColor={isFocused ? primary : "gray"}
      borderBottom={!inline}
      borderTop={!inline}
      borderLeft={!inline}
      borderRight={!inline}
      flexGrow={1}
      flexShrink={0}
      paddingX={inline ? 0 : 1}
      overflow="hidden"
      minHeight={inline ? 1 : 3}
      {...props}
    >
      <Text color={value ? "white" : "gray"}>{displayValue}</Text>
    </Box>
  );
};
