import { Box, Text } from "ink";
import { Cipher, CipherType } from "../../clients/bw.js";

export function HelpBar({
  focus,
  cipher,
  mode,
}: {
  focus: "list" | "search" | "detail";
  mode: "view" | "new";
  cipher: Cipher | null | undefined;
}) {
  return (
    <Box
      borderStyle="single"
      borderColor="#9f9f9f"
      marginTop={1}
      paddingX={1}
      flexShrink={0}
      justifyContent="space-around"
    >
      <Text color="#9f9f9f">
        <Text bold>/ </Text>Search
      </Text>
      {focus === "list" ? (
        <Text color="#9f9f9f">
          <Text bold>↑/↓ </Text>Navigate
        </Text>
      ) : focus === "detail" ? (
        <Text color="#9f9f9f">
          <Text bold>Tab/Enter </Text>Next Field
        </Text>
      ) : (
        <Text color="#9f9f9f">
          <Text bold>Esc </Text>Clear Search
        </Text>
      )}
      {focus === "list" ? (
        <Text color="#9f9f9f">
          <Text bold>Tab/Enter </Text>Select
        </Text>
      ) : focus === "detail" ? (
        <Text color="#9f9f9f">
          <Text bold>Esc </Text>Focus List
        </Text>
      ) : (
        <Text color="#9f9f9f">
          <Text bold>Tab/Enter </Text>Focus List
        </Text>
      )}
      {mode !== "new" && (
        <Text color="#9f9f9f">
          <Text bold>Ctrl+n </Text>New
        </Text>
      )}
      {...copyButtons(focus, cipher)}
      <Text color="#9f9f9f">
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
      <Text color="#9f9f9f">
        <Text bold>Ctrl+y </Text>Copy Field
      </Text>,
    ];
  }
  switch (cipher?.type) {
    case CipherType.Login:
      return [
        <Text key="copy-password" color="#9f9f9f">
          <Text bold>Ctrl+y </Text>Copy Password
        </Text>,
        ...(cipher.login?.totp
          ? [
              <Text key="copy-totp" color="#9f9f9f">
                <Text bold>Ctrl+t </Text>Copy TOTP
              </Text>,
            ]
          : []),
        <Text key="copy-username" color="#9f9f9f">
          <Text bold>Ctrl+u </Text>Copy Username
        </Text>,
      ];
    case CipherType.SecureNote:
      return [
        <Text key="copy-note" color="#9f9f9f">
          <Text bold>Ctrl+y </Text>Copy Note
        </Text>,
      ];
    case CipherType.SSHKey:
      return [
        <Text key="copy-private-key" color="#9f9f9f">
          <Text bold>Ctrl+y </Text>Copy Private Key
        </Text>,
        <Text key="copy-public-key" color="#9f9f9f">
          <Text bold>Ctrl+u </Text>Copy Public Key
        </Text>,
      ];
    default:
      return [];
  }
};
