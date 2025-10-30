import { Box, Text } from "ink";
import { Cipher, CipherType } from "../../clients/bw.js";

export function HelpBar({
  focus,
  cipher,
}: {
  focus: "list" | "search" | "detail";
  cipher: Cipher | null | undefined;
}) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      marginTop={1}
      paddingX={1}
      flexShrink={0}
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
      {...copyButtons(focus, cipher)}
      <Text color="gray">
        <Text bold>Ctrl+w </Text>Logout
      </Text>
    </Box>
  );
}

const copyButtons = (
  focus: "list" | "search" | "detail",
  cipher: Cipher | null | undefined
) => {
  if (focus === "detail") {
    return [
      <Text color="gray">
        <Text bold>Ctrl+y </Text>Copy Field
      </Text>,
    ];
  }
  switch (cipher?.type) {
    case CipherType.Login:
      return [
        <Text key="copy-password" color="gray">
          <Text bold>Ctrl+y </Text>Copy Password
        </Text>,
        ...(cipher.login?.totp
          ? [
              <Text key="copy-totp" color="gray">
                <Text bold>Ctrl+t </Text>Copy TOTP
              </Text>,
            ]
          : []),
        <Text key="copy-username" color="gray">
          <Text bold>Ctrl+u </Text>Copy Username
        </Text>,
      ];
    case CipherType.SecureNote:
      return [
        <Text key="copy-note" color="gray">
          <Text bold>Ctrl+y </Text>Copy Note
        </Text>,
      ];
    case CipherType.SSHKey:
      return [
        <Text key="copy-private-key" color="gray">
          <Text bold>Ctrl+y </Text>Copy Private Key
        </Text>,
        <Text key="copy-public-key" color="gray">
          <Text bold>Ctrl+u </Text>Copy Public Key
        </Text>,
      ];
    default:
      return [];
  }
};
