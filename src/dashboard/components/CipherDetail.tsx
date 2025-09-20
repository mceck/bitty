import { Box, Text, useFocusManager, useStdout } from "ink";
import { TextInput } from "../../components/TextInput.js";
import { primaryLight } from "../../theme/style.js";
import { Cipher, CipherType } from "mcbw";
import { Button } from "../../components/Button.js";
import { useState } from "react";
import { MoreInfoTab } from "./MoreInfoTab.js";
import { MainTab } from "./MainInfoTab.js";

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
              isActive={isFocused}
              width="50%"
              onClick={() => setIsMoreInfoTab(!isMoreInfoTab)}
            >
              More
            </Button>
            <Button
              width="50%"
              isActive={isFocused}
              onClick={() => onSave(selectedCipher!)}
            >
              Save
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
