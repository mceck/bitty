import { Box, Text, useFocusManager, useStdout } from "ink";
import { Cipher, CipherType } from "mcbw";
import { primaryLight } from "../../theme/style.js";
import { TextInput } from "../../components/TextInput.js";

export function MainTab({
  isFocused,
  selectedCipher,
  onChange,
}: {
  isFocused: boolean;
  selectedCipher: Cipher;
  onChange: (cipher: Cipher) => void;
}) {
  const { stdout } = useStdout();
  let noteH = stdout.rows - 26;
  if (selectedCipher.type !== CipherType.Login) noteH += 6;
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row">
        <Box width={15} marginRight={2} flexShrink={0}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Name:
          </Text>
        </Box>
        <Box flexGrow={1} paddingLeft={1}>
          <TextInput
            inline
            isActive={isFocused}
            value={selectedCipher.name}
            onChange={(value) => onChange({ ...selectedCipher, name: value })}
          />
        </Box>
      </Box>

      {selectedCipher.type === CipherType.Login && (
        <Box flexDirection="row">
          <Box width={15} marginRight={2} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Username:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.login?.username ?? ""}
              onChange={(value) =>
                onChange({
                  ...selectedCipher,
                  login: { ...selectedCipher.login, username: value },
                })
              }
            />
          </Box>
        </Box>
      )}

      {selectedCipher.type === CipherType.Login && (
        <Box flexDirection="row">
          <Box width={15} marginRight={2} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Password:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
            <TextInput
              inline
              isPassword
              showPasswordOnFocus
              isActive={isFocused}
              value={selectedCipher.login?.password ?? ""}
              onChange={(value) =>
                onChange({
                  ...selectedCipher,
                  login: { ...selectedCipher.login, password: value },
                })
              }
            />
          </Box>
        </Box>
      )}

      {selectedCipher.type === CipherType.Login && (
        <Box flexDirection="row">
          <Box width={15} marginRight={2} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              URL:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.login?.uris?.[0]?.uri ?? ""}
              onChange={(value) =>
                onChange({
                  ...selectedCipher,
                  login: {
                    ...selectedCipher.login,
                    uris: [
                      { uri: value },
                      ...selectedCipher.login!.uris!.slice(1),
                    ],
                  },
                })
              }
            />
          </Box>
        </Box>
      )}

      <Box flexDirection="row">
        <Box width={15} flexShrink={0} marginRight={2}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Notes:
          </Text>
        </Box>
        <Box flexGrow={1} minHeight={7}>
          <TextInput
            multiline
            maxLines={5}
            isActive={isFocused}
            value={selectedCipher.notes ?? ""}
            onChange={(value) =>
              onChange({
                ...selectedCipher,
                notes: value,
              })
            }
          />
        </Box>
      </Box>
    </Box>
  );
}
