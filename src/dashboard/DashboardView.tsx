import { useState, useEffect, useMemo } from "react";
import { Box, Text, useFocusManager, useInput, useStdout } from "ink";
import { TextInput } from "../components/TextInput.js";
import { VaultList } from "./components/VaultList.js";
import { CipherDetail, DetailTab } from "./components/CipherDetail.js";
import { HelpBar } from "./components/HelpBar.js";
import { KeybindingsView } from "./KeybindingsView.js";
import { primary } from "../theme/style.js";
import { bwClient, clearConfig, createEmptyCipher, emptyCipher, useBwSync } from "../hooks/bw.js";
import { Cipher, CipherType, SyncResponse } from "../clients/bw.js";
import { useStatusMessage } from "../hooks/status-message.js";
import { useMouseSubscribe } from "../hooks/use-mouse.js";
import { TabButton } from "../components/TabButton.js";
import { matchBinding, useKeybindings } from "../hooks/keybindings.js";

type Props = {
  onLogout: () => void;
};

type FocusableComponent = "list" | "search" | "detail";
type DetailViewMode = "view" | "new";

export function DashboardView({ onLogout }: Props) {
  const { sync, error, fetchSync } = useBwSync();
  const [syncState, setSyncState] = useState<SyncResponse | null>(sync);
  const [searchQuery, setSearchQuery] = useState("");
  const [listSelected, setListSelected] = useState<Cipher | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [focusedComponent, setFocusedComponent] =
    useState<FocusableComponent>("list");
  const [detailMode, setDetailMode] = useState<DetailViewMode>("view");
  const [editedCipher, setEditedCipher] = useState<Cipher | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("main");
  const [showKeybindings, setShowKeybindings] = useState(false);
  const { focus, focusNext } = useFocusManager();
  const { stdout } = useStdout();
  const { statusMessage, statusMessageColor, showStatusMessage } =
    useStatusMessage();
  const { keybindings } = useKeybindings();
  const filteredCiphers = useMemo(() => {
    return (
      syncState?.ciphers.filter((c) => {
        if (c.deletedDate) return false;
        if (!searchQuery?.length) return true;
        const search = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(search) ||
          c.id.toLowerCase().includes(search) ||
          c.notes?.toLowerCase().includes(search) ||
          c.login?.uri?.toLowerCase().includes(search) ||
          c.login?.username?.toLowerCase().includes(search)
        );
      }) ?? []
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [syncState, searchQuery]);
  const listIndex = useMemo(() => {
    if (!listSelected) return 0;
    const i = filteredCiphers.findIndex((c) => c.id === listSelected.id);
    return i < 0 ? 0 : i;
  }, [listSelected, filteredCiphers]);

  const selectedCipher =
    detailMode === "new" ? editedCipher : filteredCiphers[listIndex];

  const writableCollections = useMemo(
    () => (syncState?.collections ?? []).filter((c) => !c.readOnly && c.organizationId === selectedCipher?.organizationId),
    [syncState, editedCipher, filteredCiphers[listIndex]]
  );

  const organizations = useMemo(
    () => (syncState?.profile?.organizations ?? []).map(({ id, name }) => ({ id, name })),
    [syncState]
  );

  const logout = async () => {
    bwClient.logout();
    await clearConfig();
    onLogout();
  };

  useMouseSubscribe((targetId) => {
    if (targetId === "search") {
      setFocusedComponent("search");
    } else if (targetId === "list") {
      setFocusedComponent("list");
    } else {
      setFocusedComponent("detail");
      if(focusedComponent !== "detail") {
        setShowDetails(false);
      }
    }
  });

  useEffect(() => {
    setSyncState(sync);
  }, [sync]);

  useEffect(() => {
    if (error) showStatusMessage(error, "error");
  }, [error]);

  useInput(async (input, key) => {
    if (matchBinding(input, key, keybindings.logout)) {
      await logout();
      return;
    }

    if (matchBinding(input, key, keybindings.openKeybindings)) {
      setShowKeybindings(true);
      return;
    }

    if (matchBinding(input, key, keybindings.refresh)) {
      await fetchSync();
      showStatusMessage("Refreshed!", "success");
      return;
    }

    if (matchBinding(input, key, keybindings.nextTab)) {
      setActiveTab((prev) => {
        if (prev === "main") return "more";
        if (prev === "more") return syncState?.collections?.length ? "collections" : "main";
        return "main";
      });
      return;
    }
    if (matchBinding(input, key, keybindings.prevTab)) {
      setActiveTab((prev) => {
        if (prev === "main") return syncState?.collections?.length ? "collections" : "more";
        if (prev === "more") return "main";
        return "more";
      });
      return;
    }

    if (matchBinding(input, key, keybindings.focusSearch) && focusedComponent === "list") {
      setFocusedComponent("search");
      focus("search");
      return;
    }

    if (matchBinding(input, key, keybindings.newCipher)) {
      setDetailMode("new");
      setEditedCipher(emptyCipher);
      setFocusedComponent("detail");
      setActiveTab("main");
      setShowDetails(false);
      return;
    }

    if (key.escape) {
      setFocusedComponent("list");
      setDetailMode("view");
      setActiveTab("main");
    }

    if (focusedComponent === "search") {
      if (key.escape && searchQuery?.length) {
        setSearchQuery("");
      } else if (key.tab) {
        setFocusedComponent("list");
        focus("list");
        return;
      }
    } else if (focusedComponent === "list") {
      if (key.return || key.tab) {
        setFocusedComponent("detail");
        setShowDetails(false);
      }
    }
  }, { isActive: !showKeybindings });

  useEffect(() => {
    if (showDetails) return;
    setShowDetails(true);
    setTimeout(focusNext, 50);
  }, [showDetails]);

  return (
    <Box flexDirection="column" width="100%" height={stdout.rows - 2}>
      <Box
        borderStyle="double"
        borderColor={primary}
        paddingX={2}
        justifyContent="center"
        flexShrink={0}
      >
        <Text bold color={primary}>
          BiTTY
        </Text>
      </Box>

      {showKeybindings ? (
        <KeybindingsView onClose={() => setShowKeybindings(false)} />
      ) : (
        <>
          <Box flexShrink={0}>
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
            <Box width="60%" paddingX={1} justifyContent="space-between">
              {statusMessage ? (
                <Box padding={1} flexShrink={1}>
                  <Text color={statusMessageColor}>{statusMessage}</Text>
                </Box>
              ) : (
                <Box />
              )}
              <Box gap={1} flexShrink={0}>
                <TabButton
                  active={false}
                  onClick={() => setShowKeybindings(true)}
                >
                  ⚙
                </TabButton>
                <TabButton
                  active={false}
                  onClick={async () => {
                    await fetchSync();
                    showStatusMessage("Refreshed!", "success");
                  }}
                >
                  ⟳
                </TabButton>
                {selectedCipher && (
                  <>
                    <TabButton
                      active={activeTab === "main"}
                      onClick={() => setActiveTab("main")}
                    >
                      Main
                    </TabButton>
                    <TabButton
                      active={activeTab === "more"}
                      onClick={() => setActiveTab("more")}
                    >
                      More
                    </TabButton>
                    {!!syncState?.collections?.length && (
                      <TabButton
                        active={activeTab === "collections"}
                        onClick={() => setActiveTab("collections")}
                      >
                        Collections
                      </TabButton>
                    )}
                  </>
                )}
              </Box>
            </Box>
          </Box>

          <Box minHeight={20} flexGrow={1}>
            <VaultList
              filteredCiphers={filteredCiphers}
              isFocused={["list", "search"].includes(focusedComponent)}
              selected={listIndex}
              onSelect={(index) => setListSelected(filteredCiphers[index] || null)}
            />

            <CipherDetail
              selectedCipher={showDetails ? selectedCipher : null}
              mode={detailMode}
              activeTab={activeTab}
              collections={writableCollections}
              organizations={organizations}
              isFocused={focusedComponent === "detail"}
              onTypeChange={(type) => {
                const fresh = createEmptyCipher(type);
                fresh.name = editedCipher?.name ?? "";
                fresh.notes = editedCipher?.notes ?? null;
                fresh.collectionIds = editedCipher?.collectionIds ?? [];
                fresh.organizationId = editedCipher?.organizationId ?? null;
                setEditedCipher(fresh);
              }}
              onReset={async () => {
                bwClient.decryptedSyncCache = null;
                await fetchSync(false);
                showStatusMessage("Resetted!", "success");
              }}
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
              onDelete={async (cipher) => {
                showStatusMessage("Deleting...");
                try {
                  await bwClient.deleteSecret(cipher.id);
                  fetchSync();
                  showStatusMessage("Deleted!", "success");
                  setFocusedComponent("list");
                  setActiveTab("main");
                } catch (e) {
                  showStatusMessage("Delete error", "error");
                }
              }}
              onSave={async (cipher) => {
                showStatusMessage("Saving...");
                if (detailMode === "new") {
                  try {
                    if (cipher.organizationId && !cipher.collectionIds?.length) {
                      showStatusMessage("Select at least one collection", "error");
                      return;
                    }
                    await bwClient.createSecret(cipher);
                    fetchSync();
                    showStatusMessage("Saved!", "success");
                    setDetailMode("view");
                    setFocusedComponent("list");
                    setActiveTab("main");
                  } catch (e) {
                    showStatusMessage("Synchronization error", "error");
                  }
                } else {
                  try {
                    const original = sync?.ciphers.find((c) => c.id === cipher.id);
                    const originalOrgId = original?.organizationId ?? null;
                    const originalCollections = original?.collectionIds ?? [];
                    const newCollections = [...cipher.collectionIds ?? []];

                    // Sharing: personal cipher being assigned to an org
                    if (!originalOrgId && cipher.organizationId) {
                      if (!newCollections.length) {
                        showStatusMessage("Select at least one collection to share", "error");
                        return;
                      }
                      await bwClient.shareCipher(cipher.id, cipher, newCollections);
                      fetchSync();
                      showStatusMessage("Shared!", "success");
                      setFocusedComponent("list");
                      setActiveTab("main");
                      return;
                    }

                    const updated = await bwClient.updateSecret(cipher.id, cipher);
                    const collectionsChanged =
                      originalCollections.length !== newCollections.length ||
                      originalCollections.some((id) => !newCollections.includes(id));
                    if (collectionsChanged) {
                      await bwClient.updateCollections(cipher.id, newCollections);
                    }
                    if (!updated && !collectionsChanged) {
                      showStatusMessage("Nothing to save");
                      return;
                    }
                    fetchSync();
                    showStatusMessage("Saved!", "success");
                    setFocusedComponent("list");
                    setActiveTab("main");
                  } catch (e) {
                    showStatusMessage("Synchronization error", "error");
                  }
                }
              }}
            />
          </Box>

          <HelpBar
            focus={focusedComponent}
            cipher={selectedCipher}
            mode={detailMode}
          />
        </>
      )}
    </Box>
  );
}
