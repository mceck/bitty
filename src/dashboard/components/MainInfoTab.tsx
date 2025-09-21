import { Box, Text } from "ink";
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
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row">
        <Box width={12} marginRight={2} flexShrink={0}>
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
          <Box width={12} marginRight={2} flexShrink={0}>
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
          <Box width={12} marginRight={2} flexShrink={0}>
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
          <Box width={12} marginRight={2} flexShrink={0}>
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

      {selectedCipher.type === CipherType.SSHKey && (
        <Box flexDirection="row">
          <Box width={12} marginRight={2} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Private Key:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.sshKey?.privateKey ?? ""}
            />
          </Box>
        </Box>
      )}
      {selectedCipher.type === CipherType.SSHKey && (
        <Box flexDirection="row">
          <Box width={12} marginRight={2} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Public Key:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.sshKey?.publicKey ?? ""}
            />
          </Box>
        </Box>
      )}

      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.firstName && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                First Name:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.firstName ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, firstName: value },
                  })
                }
              />
            </Box>
          </Box>
        )}
      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.lastName && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Last Name:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.lastName ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, lastName: value },
                  })
                }
              />
            </Box>
          </Box>
        )}
      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.username && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Username:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.username ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, username: value },
                  })
                }
              />
            </Box>
          </Box>
        )}
      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.city && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                City:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.city ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, city: value },
                  })
                }
              />
            </Box>
          </Box>
        )}
      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.address1 && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Address:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.address1 ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, address1: value },
                  })
                }
              />
            </Box>
          </Box>
        )}
      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.country && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Country:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.country ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, country: value },
                  })
                }
              />
            </Box>
          </Box>
        )}
      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.email && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Email:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.email ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, email: value },
                  })
                }
              />
            </Box>
          </Box>
        )}
      {selectedCipher.type === CipherType.Identity &&
        selectedCipher.identity?.phone && (
          <Box flexDirection="row">
            <Box width={12} marginRight={2} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Phone:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={selectedCipher.identity?.phone ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    identity: { ...selectedCipher.identity!, phone: value },
                  })
                }
              />
            </Box>
          </Box>
        )}

      <Box flexDirection="row">
        <Box width={12} flexShrink={0} marginRight={2}>
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
