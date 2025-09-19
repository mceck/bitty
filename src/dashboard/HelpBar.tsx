import { Box, Text } from "ink";

export function HelpBar() {
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
      <Text color="gray">
        <Text bold>↑/↓ </Text>Navigate
      </Text>
      <Text color="gray">
        <Text bold>Tab/Enter </Text>Focus
      </Text>
      <Text color="gray">
        <Text bold>C/Y </Text>Copy
      </Text>
      <Text color="gray">
        <Text bold>Enter </Text>Edit
      </Text>
      <Text color="gray">
        <Text bold>n </Text>New
      </Text>
      <Text color="gray">
        <Text bold>q </Text>Quit
      </Text>
    </Box>
  );
}
