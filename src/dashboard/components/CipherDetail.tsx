import { Box } from "ink";
import { primaryLight } from "../../theme/style.js";
import { Cipher } from "mcbw";
import { Button } from "../../components/Button.js";
import { useState } from "react";
import { MoreInfoTab } from "./MoreInfoTab.js";
import { MainTab } from "./MainInfoTab.js";

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
          <Box marginTop={1} flexShrink={0}>
            {mode !== "new" && (
              <Button
                isActive={isFocused}
                width="50%"
                onClick={() => setIsMoreInfoTab(!isMoreInfoTab)}
              >
                More
              </Button>
            )}
            <Button
              width="50%"
              doubleConfirm
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
