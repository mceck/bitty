import { Box } from "ink";
import { primaryLight } from "../../theme/style.js";
import { Cipher, CipherType, Collection } from "../../clients/bw.js";
import { Button } from "../../components/Button.js";
import { MoreInfoTab, Organization } from "./MoreInfoTab.js";
import { MainTab } from "./MainTab.js";
import { CollectionsTab } from "./CollectionsTab.js";

export type DetailTab = "main" | "more" | "collections";

export function CipherDetail({
  selectedCipher,
  isFocused,
  mode,
  activeTab,
  collections,
  organizations,
  onChange,
  onSave,
  onDelete,
  onReset,
  onTypeChange,
}: {
  selectedCipher: Cipher | null | undefined;
  isFocused: boolean;
  mode: "view" | "new";
  activeTab: DetailTab;
  collections: Collection[];
  organizations: Organization[];
  onChange: (cipher: Cipher) => void;
  onSave: (cipher: Cipher) => void;
  onDelete: (cipher: Cipher) => void;
  onReset: () => void;
  onTypeChange?: (type: CipherType) => void;
}) {
  return (
    <Box
      flexDirection="column"
      width="60%"
      flexGrow={1}
      paddingX={1}
      borderStyle="round"
      borderColor={isFocused ? primaryLight : "#9f9f9f"}
      borderLeftColor="#9f9f9f"
    >
      {selectedCipher && (
        <Box flexDirection="column" justifyContent="space-between" flexGrow={1}>
          {activeTab === "more" ? (
            <MoreInfoTab
              isFocused={isFocused}
              selectedCipher={selectedCipher}
              organizations={organizations}
              onChange={onChange}
            />
          ) : activeTab === "collections" ? (
            <CollectionsTab
              isFocused={isFocused}
              selectedCipher={selectedCipher}
              collections={collections}
              onChange={onChange}
            />
          ) : (
            <MainTab
              isFocused={isFocused}
              selectedCipher={selectedCipher}
              mode={mode}
              onChange={onChange}
              onTypeChange={onTypeChange}
            />
          )}
          <Box marginTop={1} flexShrink={0} gap={1}>
            <Button
              doubleConfirm
              width="49%"
              isActive={isFocused}
              onClick={() => onSave(selectedCipher!)}
            >
              Save
            </Button>
            {mode !== "new" && (
              <>
              <Button
                doubleConfirm
                width="25%"
                activeBorderColor="yellow"
                isActive={isFocused}
                onClick={() =>onReset()}
                >
                Reset
              </Button>
              <Button
                tripleConfirm
                width="25%"
                activeBorderColor="red"
                isActive={isFocused}
                onClick={() => onDelete(selectedCipher!)}
                >
                Delete
              </Button>
                </>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
