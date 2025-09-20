import { useState, useEffect, useMemo } from "react";
import { Box, Text, useFocusManager, useInput, useStdout } from "ink";
import { TextInput } from "../components/TextInput.js";
import { VaultList } from "./VaultList.js";
import { CipherDetail } from "./CipherDetail.js";
import { HelpBar } from "./HelpBar.js";
import { primary } from "../theme/style.js";
import { bwClient, clearConfig, useBwSync } from "../hooks/bw.js";
import { Cipher, SyncResponse } from "mcbw";
import { useStatusMessage } from "../hooks/status-message.js";

type Props = {
  onLogout: () => void;
};

type FocusableComponent = "list" | "search" | "detail";
type DetailViewMode = "view" | "new";

export function DashboardView({ onLogout }: Props) {
  const { sync } = useBwSync();
  const [syncState, setSyncState] = useState<SyncResponse | null>(sync);
  const [searchQuery, setSearchQuery] = useState("");
  const [listIndex, setListIndex] = useState(0);
  const [focusedComponent, setFocusedComponent] =
    useState<FocusableComponent>("list");
  const [detailMode, setDetailMode] = useState<DetailViewMode>("view");
  const [editedCipher, setEditedCipher] = useState<Cipher | null>(null);
  const { focus, focusNext } = useFocusManager();
  const { stdout } = useStdout();
  const { statusMessage, statusMessageColor, showStatusMessage } =
    useStatusMessage();

  const filteredCiphers = useMemo(() => {
    return (
      syncState?.ciphers.filter(
        (c) =>
          !c.deletedDate &&
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) ?? []
    );
  }, [syncState, searchQuery]);

  const selectedCipher =
    detailMode === "new" ? editedCipher : filteredCiphers[listIndex];

  useEffect(() => {
    setListIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    setSyncState(sync);
  }, [sync]);

  useEffect(() => {
    if (focusedComponent === "detail") focusNext();
  }, [focusedComponent]);

  useInput(async (input, key) => {
    if (key.ctrl && input === "w") {
      await clearConfig();
      onLogout();
      return;
    }

    if (input === "/" && focusedComponent !== "search") {
      setFocusedComponent("search");
      focus("search");
      return;
    }

    if (key.escape) {
      if (focusedComponent === "search" && searchQuery?.length) {
        setSearchQuery("");
      } else {
        setFocusedComponent("list");
      }
      setDetailMode("view");
      return;
    }

    if (key.tab && focusedComponent === "search") {
      setFocusedComponent("list");
      focus("list");
      return;
    }

    if (key.rightArrow && focusedComponent === "list" && selectedCipher) {
      setFocusedComponent("detail");
      return;
    }

    if (focusedComponent === "list") {
      if (key.return || key.tab) setFocusedComponent("detail");
      if (input === "n") {
        setDetailMode("new");
        setEditedCipher({} as any);
        setFocusedComponent("detail");
      }
    } else if (focusedComponent === "detail") {
    }
  });

  return (
    <Box flexDirection="column" width="100%" minHeight={stdout.rows - 2}>
      <Box
        borderStyle="double"
        borderColor={primary}
        paddingX={2}
        justifyContent="center"
      >
        <Text bold color={primary}>
          Bitwarden TUI
        </Text>
      </Box>

      <Box>
        <Box width="40%">
          <TextInput
            id="search"
            placeholder={
              focusedComponent === "search" ? "" : "[/] Search in vault"
            }
            value={searchQuery}
            isActive={false}
            onChange={setSearchQuery}
            onSubmit={() => {
              setFocusedComponent("list");
              focusNext();
            }}
          />
        </Box>
        {statusMessage && (
          <Box width="60%" padding={1}>
            <Text color={statusMessageColor}>{statusMessage}</Text>
          </Box>
        )}
      </Box>

      <Box minHeight={20} flexGrow={1}>
        <VaultList
          filteredCiphers={filteredCiphers}
          isFocused={focusedComponent === "list"}
          onSelect={(index) => setListIndex(index)}
        />

        <CipherDetail
          selectedCipher={selectedCipher}
          isFocused={focusedComponent === "detail"}
          onChange={(cipher) => {
            if (detailMode === "new") {
              setEditedCipher(cipher);
              return;
            }
            const updatedCiphers = syncState?.ciphers.map((c) =>
              c.id === cipher.id ? cipher : c
            );
            setSyncState((prev) => ({ ...prev!, ciphers: updatedCiphers! }));
          }}
          onSave={async (cipher) => {
            showStatusMessage("Saving...");
            try {
              const original = bwClient.syncCache?.ciphers.find(
                (c) => c.id === cipher.id
              );
              const decrypted = bwClient.decryptedSyncCache?.ciphers.find(
                (c) => c.id === cipher.id
              );
              if (!original || !decrypted) {
                throw new Error("Original cipher not found");
              }
              const patch = deepDiff(decrypted, cipher);
              if (patch) {
                await bwClient.updateSecret(original, patch);
                showStatusMessage("Saved!", "success");
              } else {
                showStatusMessage("Nothing to save");
              }
            } catch (e) {
              showStatusMessage("Synchronization error", "error");
            }
          }}
        />
      </Box>

      <HelpBar focus={focusedComponent} />
    </Box>
  );
}

const deepDiff = (obj1: any, obj2: any): any => {
  if (
    typeof obj1 !== "object" ||
    obj1 === null ||
    typeof obj2 !== "object" ||
    obj2 === null
  ) {
    return obj1 !== obj2 ? obj2 : undefined;
  }

  let diff: any = Array.isArray(obj2) ? [] : {};

  let changed = false;
  for (const key in obj2) {
    if (!(key in obj1)) {
      diff[key] = obj2[key];
      changed = true;
    } else {
      const subDiff = deepDiff(obj1[key], obj2[key]);
      if (subDiff !== undefined) {
        diff[key] = subDiff;
        changed = true;
      }
    }
  }

  return changed ? diff : undefined;
};
