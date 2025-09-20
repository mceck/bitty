import { Box, Text } from "ink";

export function HelpBar({ focus }: { focus: "list" | "search" | "detail" }) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      marginTop={1}
      paddingX={1}
      justifyContent="space-around"
    >
      <Text color="gray">
        <Text bold>/ </Text>Search
      </Text>
      {focus === "list" ? (
        <Text color="gray">
          <Text bold>↑/↓ </Text>Navigate
        </Text>
      ) : focus === "detail" ? (
        <Text color="gray">
          <Text bold>Tab/Enter </Text>Next Field
        </Text>
      ) : (
        <Text color="gray">
          <Text bold>Esc </Text>Clear Search
        </Text>
      )}
      {focus === "list" ? (
        <Text color="gray">
          <Text bold>Tab/Enter </Text>Select
        </Text>
      ) : focus === "detail" ? (
        <Text color="gray">
          <Text bold>Esc </Text>Focus List
        </Text>
      ) : (
        <Text color="gray">
          <Text bold>Tab/Enter </Text>Focus List
        </Text>
      )}
      <Text color="gray">
        <Text bold>Ctrl+y </Text>Copy Field
      </Text>
      <Text color="gray">
        <Text bold>Ctrl+w </Text>Logout
      </Text>
    </Box>
  );
}
