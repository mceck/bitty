import { Box, Text, useFocusManager, useStdout } from "ink";
import { Cipher, CipherType } from "../../clients/bw.js";
import { primaryLight } from "../../theme/style.js";
import { TextInput } from "../../components/TextInput.js";

export function MoreInfoTab({
  isFocused,
  selectedCipher,
  onChange,
}: {
  isFocused: boolean;
  selectedCipher: Cipher;
  onChange: (cipher: Cipher) => void;
}) {
  const { stdout } = useStdout();
  return (
    <Box flexDirection="column" gap={1} height={stdout.rows - 18}>
      <Box flexDirection="row">
        <Box width={9} flexShrink={0}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            ID:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <TextInput
            inline
            isActive={isFocused}
            value={selectedCipher.id ?? ""}
          />
        </Box>
      </Box>
      {!!selectedCipher.organizationId && (
        <Box flexDirection="row">
          <Box width={18}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Organization ID:
            </Text>
          </Box>
          <Box flexGrow={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.organizationId ?? ""}
            />
          </Box>
        </Box>
      )}
      {!!selectedCipher.collectionIds?.length && (
        <Box flexDirection="row">
          <Box width={18}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Collection IDs:
            </Text>
          </Box>
          <Box flexGrow={1}>
            <Box flexDirection="column">
              {selectedCipher.collectionIds?.map((id) => (
                <TextInput key={id} inline isActive={isFocused} value={id} />
              )) || <Text>-</Text>}
            </Box>
          </Box>
        </Box>
      )}
      {!!selectedCipher.folderId && (
        <Box flexDirection="row">
          <Box width={18}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Folder ID:
            </Text>
          </Box>
          <Box flexGrow={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.folderId ?? ""}
            />
          </Box>
        </Box>
      )}
      {selectedCipher.type === CipherType.Identity && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row">
            <Box width={9} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                Address:
              </Text>
            </Box>
            <Box flexGrow={1}>
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
          <Box flexDirection="row">
            <Box width={9} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                City:
              </Text>
            </Box>
            <Box flexGrow={1}>
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
          <Box flexDirection="row" flexGrow={1} gap={1}>
            <Box flexDirection="row" width="40%" flexShrink={0}>
              <Box width={9} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  State:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.state ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...selectedCipher,
                      identity: { ...selectedCipher.identity!, state: value },
                    })
                  }
                />
              </Box>
            </Box>
            <Box flexDirection="row" width="60%" flexShrink={0}>
              <Box width={13} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  Postal Code:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.postalCode ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...selectedCipher,
                      identity: {
                        ...selectedCipher.identity!,
                        postalCode: value,
                      },
                    })
                  }
                />
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row" flexGrow={1} gap={1}>
            <Box flexDirection="row" width="40%" flexShrink={0}>
              <Box width={9} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  Country:
                </Text>
              </Box>
              <Box flexGrow={1}>
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
            <Box flexDirection="row" width="60%" flexShrink={0}>
              <Box width={13} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  License:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.licenseNumber ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...selectedCipher,
                      identity: {
                        ...selectedCipher.identity!,
                        licenseNumber: value,
                      },
                    })
                  }
                />
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row" flexGrow={1} gap={1}>
            <Box flexDirection="row" width="40%" flexShrink={0}>
              <Box width={9} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  SSN:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  isPassword
                  showPasswordOnFocus
                  value={selectedCipher.identity?.ssn ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...selectedCipher,
                      identity: { ...selectedCipher.identity!, ssn: value },
                    })
                  }
                />
              </Box>
            </Box>
            <Box flexDirection="row" width="60%" flexShrink={0}>
              <Box width={13} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  Passport:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.passportNumber ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...selectedCipher,
                      identity: {
                        ...selectedCipher.identity!,
                        passportNumber: value,
                      },
                    })
                  }
                />
              </Box>
            </Box>
          </Box>
        </Box>
      )}
      {selectedCipher.type === CipherType.SSHKey && (
        <Box flexDirection="row">
          <Box width={13} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Fingerprint:
            </Text>
          </Box>
          <Box flexGrow={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.sshKey?.keyFingerprint ?? ""}
            />
          </Box>
        </Box>
      )}
      {!!selectedCipher.fields?.length && (
        <Box flexDirection="column">
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Fields:
          </Text>
          {selectedCipher.fields?.map((field, idx) => (
            <Box flexDirection="row" key={idx} paddingLeft={2}>
              <Box width={16}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  {field.name || idx}:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={field.value ?? ""}
                  onChange={(value) => {
                    const newFields = selectedCipher.fields?.map((f, i) =>
                      i === idx ? { ...f, value } : f,
                    );
                    onChange({ ...selectedCipher, fields: newFields });
                  }}
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {!!selectedCipher.login?.uris?.length && (
        <Box flexDirection="column">
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Uris:
          </Text>
          {selectedCipher.login.uris.map((uri, idx) => (
            <Box flexDirection="row" key={idx} paddingLeft={2}>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={uri.uri ?? ""}
                  onChange={(value) => {
                    const newUris = selectedCipher.login?.uris?.map((u, i) =>
                      i === idx ? { ...u, uri: value } : u,
                    );
                    onChange({
                      ...selectedCipher,
                      login: { ...selectedCipher.login, uris: newUris },
                    });
                  }}
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
