import { Box } from "ink";
import { primaryLight } from "../../theme/style.js";
import { Cipher, CipherType } from "../../clients/bw.js";
import { Button } from "../../components/Button.js";
import { useState } from "react";
import { MoreInfoTab } from "./MoreInfoTab.js";
import { MainTab } from "./MainTab.js";

export function CipherDetail({
  selectedCipher,
  isFocused,
  mode,
  onChange,
  onSave,
}: {
  selectedCipher: Cipher | null | undefined;
  isFocused: boolean;
  mode: "view" | "new";
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
        <Box flexDirection="column" justifyContent="space-between" flexGrow={1}>
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
          <Box marginTop={1} flexShrink={0} gap={1}>
            {mode !== "new" && (
              <Button
                width="50%"
                isActive={isFocused}
                onClick={() => setIsMoreInfoTab(!isMoreInfoTab)}
              >
                More
              </Button>
            )}
            {selectedCipher.type !== CipherType.SSHKey && (
              <Button
                doubleConfirm
                width="50%"
                isActive={isFocused}
                onClick={() => onSave(selectedCipher!)}
              >
                Save
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
