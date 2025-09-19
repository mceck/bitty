import { Box, Text, useFocusManager } from "ink";
import { Cipher } from "./models.js";
import { TextInput } from "../components/TextInput.js";
import { primaryLight } from "../theme/style.js";

export function CipherDetail({
  selectedCipher,
  isFocused,
  onChange,
}: {
  selectedCipher: Cipher | null | undefined;
  isFocused: boolean;
  onChange: (cipher: Cipher) => void;
}) {
  const { focusNext } = useFocusManager();
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      borderStyle="round"
      borderColor={isFocused ? primaryLight : "gray"}
      borderLeftColor="gray"
    >
      {selectedCipher && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row">
            <Box width={15} marginRight={2}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Name:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.name}
                onSubmit={focusNext}
                onChange={(value) =>
                  onChange({ ...selectedCipher, name: value })
                }
              />
            </Box>
          </Box>

          <Box flexDirection="row">
            <Box width={15} marginRight={2}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Username:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.login?.username ?? ""}
                onSubmit={focusNext}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    login: { ...selectedCipher.login, username: value },
                  })
                }
              />
            </Box>
          </Box>

          <Box flexDirection="row">
            <Box width={15} marginRight={2}>
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
                onSubmit={focusNext}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    login: { ...selectedCipher.login, password: value },
                  })
                }
              />
            </Box>
          </Box>

          <Box flexDirection="row">
            <Box width={15} marginRight={2}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                URL:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.login?.uri ?? ""}
                onSubmit={focusNext}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    login: { ...selectedCipher.login, uri: value },
                  })
                }
              />
            </Box>
          </Box>

          <Box flexDirection="row">
            <Box width={15} marginRight={2}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Notes:
              </Text>
            </Box>
            <Box flexGrow={1}>
              <TextInput
                multiline
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
      )}
    </Box>
  );
}
