import { Box, Text, useFocusManager, useStdout } from "ink";
import { Cipher, CipherType } from "mcbw";
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
        <Box width={18} marginRight={2}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            ID:
          </Text>
        </Box>
        <Box flexGrow={1} paddingLeft={1}>
          <TextInput
            inline
            isActive={isFocused}
            value={selectedCipher.id ?? ""}
          />
        </Box>
      </Box>
      {!!selectedCipher.organizationId && (
        <Box flexDirection="row">
          <Box width={18} marginRight={2}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Organization ID:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
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
          <Box width={18} marginRight={2}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Collection IDs:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
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
          <Box width={18} marginRight={2}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Folder ID:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
            <TextInput
              inline
              isActive={isFocused}
              value={selectedCipher.folderId ?? ""}
            />
          </Box>
        </Box>
      )}
      {selectedCipher.type === CipherType.SSHKey && (
        <Box flexDirection="row">
          <Box width={12} marginRight={2} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "gray"}>
              Fingerprint:
            </Text>
          </Box>
          <Box flexGrow={1} paddingLeft={1}>
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
              <Box width={16} marginRight={2}>
                <Text bold color={isFocused ? primaryLight : "gray"}>
                  {field.name || idx}:
                </Text>
              </Box>
              <Box flexGrow={1} paddingLeft={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={field.value ?? ""}
                  onChange={(value) => {
                    const newFields = selectedCipher.fields?.map((f, i) =>
                      i === idx ? { ...f, value } : f
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
              <Box flexGrow={1} paddingLeft={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={uri.uri ?? ""}
                  onChange={(value) => {
                    const newUris = selectedCipher.login?.uris?.map((u, i) =>
                      i === idx ? { ...u, uri: value } : u
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
