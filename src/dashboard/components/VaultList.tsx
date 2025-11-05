import { Box, Text, useInput, useStdout } from "ink";
import { primary, primaryDark, primaryLight } from "../../theme/style.js";
import { Cipher, CipherType } from "../../clients/bw.js";
import { ScrollView } from "../../components/ScrollView.js";
import clipboard from "clipboardy";
import { useStatusMessage } from "../../hooks/status-message.js";

const getTypeIcon = (type: CipherType) => {
  switch (type) {
    case CipherType.Login:
      return "🔑";
    case CipherType.SecureNote:
      return "📝";
    case CipherType.Card:
      return "💳";
    case CipherType.Identity:
      return "🆔";
    default:
      return "❓";
  }
};

export function VaultList({
  filteredCiphers,
  isFocused,
  selected,
  onSelect,
}: {
  filteredCiphers: Cipher[];
  isFocused: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const { stdout } = useStdout();
  const { showStatusMessage } = useStatusMessage();
  useInput(
    (input, key) => {
      const cipher = selected !== null ? filteredCiphers[selected] : null;
      let field, fldName;
      if (key.ctrl && input === "y") {
        switch (cipher?.type) {
          case CipherType.Login:
            field = cipher.login?.password;
            fldName = "Password";
            break;
          case CipherType.SecureNote:
            field = cipher.notes;
            fldName = "Note";
            break;
          case CipherType.SSHKey:
            field = cipher.sshKey?.privateKey;
            fldName = "Private Key";
            break;
        }
      } else if (key.ctrl && input === "u") {
        switch (cipher?.type) {
          case CipherType.Login:
            field = cipher.login?.username;
            fldName = "Username";
            break;
          case CipherType.SSHKey:
            field = cipher.sshKey?.publicKey;
            fldName = "Public Key";
            break;
        }
      } else if (key.ctrl && input === "t") {
        if (cipher?.type === CipherType.Login) {
          field = cipher.login?.currentTotp;
          fldName = "TOTP";
        }
      }
      if (field) {
        clipboard.writeSync(field);
        showStatusMessage(`📋 Copied ${fldName} to clipboard!`, "success");
      }
    },
    { isActive: isFocused }
  );
  return (
    <Box
      flexDirection="column"
      width="40%"
      borderStyle="round"
      borderColor={isFocused ? primaryLight : "gray"}
      borderRightColor="gray"
      paddingX={1}
      overflow="hidden"
    >
      <ScrollView
        isActive={isFocused}
        count={Math.max(stdout.rows - 14, 20)}
        list={filteredCiphers}
        selectedIndex={selected ?? 0}
        onSelect={onSelect}
      >
        {({ el: cipher, selected }) => (
          <Box
            key={cipher.id}
            justifyContent="space-between"
            backgroundColor={
              selected ? (isFocused ? primary : primaryDark) : ""
            }
          >
            <Box>
              <Text>{getTypeIcon(cipher.type)} </Text>
              <Text
                color={selected && isFocused ? "white" : "default"}
                wrap="truncate"
              >
                {cipher.name}
              </Text>
            </Box>
            {cipher.favorite && <Text color="yellow">★</Text>}
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
