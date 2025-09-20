import { Box, Text, useFocusManager, useStdout } from "ink";
import { TextInput } from "../components/TextInput.js";
import { primaryLight } from "../theme/style.js";
import { Cipher } from "mcbw";
import { Button } from "../components/Button.js";
import { useState } from "react";

export function CipherDetail({
  selectedCipher,
  isFocused,
  onChange,
  onSave,
}: {
  selectedCipher: Cipher | null | undefined;
  isFocused: boolean;
  onChange: (cipher: Cipher) => void;
  onSave: (cipher: Cipher) => void;
}) {
  const [isMoreInfoTab, setIsMoreInfoTab] = useState(false);

  return (
    <Box
      flexDirection="column"
      width="60%"
      flexGrow={1}
      paddingX={1}
      borderStyle="round"
      borderColor={isFocused ? primaryLight : "gray"}
      borderLeftColor="gray"
    >
      {selectedCipher && (
        <Box flexDirection="column">
          {isMoreInfoTab ? (
            <MoreInfoTab
              isFocused={isFocused}
              selectedCipher={selectedCipher}
              onChange={onChange}
            />
          ) : (
            <MainTab
              isFocused={isFocused}
              selectedCipher={selectedCipher}
              onChange={onChange}
            />
          )}
          <Box marginTop={1}>
            <Button
              width="50%"
              onClick={() => setIsMoreInfoTab(!isMoreInfoTab)}
            >
              More
            </Button>
            <Button width="50%" onClick={() => onSave(selectedCipher!)}>
              Save
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function MainTab({
  isFocused,
  selectedCipher,
  onChange,
}: {
  isFocused: boolean;
  selectedCipher: Cipher;
  onChange: (cipher: Cipher) => void;
}) {
  const { focusNext } = useFocusManager();
  const { stdout } = useStdout();
  return (
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
            onChange={(value) => onChange({ ...selectedCipher, name: value })}
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
        <Box width={15} flexShrink={0} marginRight={2}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Notes:
          </Text>
        </Box>
        <Box flexGrow={1} height={stdout.rows - 26}>
          <TextInput
            multiline
            maxLines={stdout.rows - 28}
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

function MoreInfoTab({
  isFocused,
  selectedCipher,
  onChange,
}: {
  isFocused: boolean;
  selectedCipher: Cipher;
  onChange: (cipher: Cipher) => void;
}) {
  const { focusNext } = useFocusManager();
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
          <Text>{selectedCipher.id ?? ""}</Text>
        </Box>
      </Box>
      <Box flexDirection="row">
        <Box width={18} marginRight={2}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Organization ID:
          </Text>
        </Box>
        <Box flexGrow={1} paddingLeft={1}>
          <Text>{selectedCipher.organizationId ?? ""}</Text>
        </Box>
      </Box>
      <Box flexDirection="row">
        <Box width={18} marginRight={2}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Collection IDs:
          </Text>
        </Box>
        <Box flexGrow={1} paddingLeft={1}>
          <Box flexDirection="column">
            {selectedCipher.collectionIds?.map((id) => (
              <Text key={id}>{id}</Text>
            )) || <Text>-</Text>}
          </Box>
        </Box>
      </Box>
      <Box flexDirection="row">
        <Box width={18} marginRight={2}>
          <Text bold color={isFocused ? primaryLight : "gray"}>
            Folder ID:
          </Text>
        </Box>
        <Box flexGrow={1} paddingLeft={1}>
          <Text>{selectedCipher.folderId}</Text>
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold color={isFocused ? primaryLight : "gray"}>
          Fields:
        </Text>
        {selectedCipher.fields?.map((field, idx) => (
          <Box flexDirection="row" key={idx} paddingLeft={2}>
            <Box width={16} marginRight={2}>
              <Text bold color={isFocused ? primaryLight : "gray"}>
                {field.name}:
              </Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <TextInput
                inline
                isActive={isFocused}
                value={field.value ?? ""}
                onSubmit={focusNext}
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
      <Box flexDirection="column">
        <Text bold color={isFocused ? primaryLight : "gray"}>
          Uris:
        </Text>
        {selectedCipher.login?.uris?.map((uri, idx) => (
          <Box flexDirection="row" key={idx} paddingLeft={2}>
            <Box flexGrow={1} paddingLeft={1}>
              <Text>{uri.uri}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
