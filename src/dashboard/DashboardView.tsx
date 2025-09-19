import { useState, useEffect } from "react";
import { Box, Text, useFocusManager, useInput } from "ink";
import { TextInput } from "../components/TextInput.js";
import { Button } from "../components/Button.js";
import { Cipher, mockCiphers, newCipherTemplate } from "./models.js";
import { VaultList } from "./VaultList.js";
import { CipherDetail } from "./CipherDetail.js";
import { HelpBar } from "./HelpBar.js";
import { primary } from "../theme/style.js";

type Props = {
  onLogout: () => void;
};

type FocusableComponent = "list" | "search" | "detail";
type DetailViewMode = "view" | "new";

export function DashboardView({ onLogout }: Props) {
  const [ciphers, setCiphers] = useState(mockCiphers);
  const [searchQuery, setSearchQuery] = useState("");
  const [listIndex, setListIndex] = useState(0);
  const [focusedComponent, setFocusedComponent] =
    useState<FocusableComponent>("list");
  const [detailMode, setDetailMode] = useState<DetailViewMode>("view");
  const [editedCipher, setEditedCipher] = useState<Cipher | null>(null);
  const { focus, focusNext } = useFocusManager();

  const filteredCiphers = ciphers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCipher =
    detailMode === "new" ? editedCipher : filteredCiphers[listIndex];

  useEffect(() => {
    setListIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (focusedComponent === "detail") focusNext();
  }, [focusedComponent]);

  useInput((input, key) => {
    console.log({ input, key });
    if (key.ctrl && input === "w") {
      onLogout();
      return;
    }

    if (input === "/" && focusedComponent !== "search") {
      setFocusedComponent("search");
      focus("search");
      return;
    }

    if (key.escape) {
      setFocusedComponent("list");
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
      if (key.upArrow) setListIndex((prev) => Math.max(0, prev - 1));
      if (key.downArrow)
        setListIndex((prev) => Math.min(filteredCiphers.length - 1, prev + 1));
      if (key.return || key.tab) setFocusedComponent("detail");
      if (input === "n") {
        setDetailMode("new");
        setEditedCipher({ ...newCipherTemplate });
        setFocusedComponent("detail");
      }
    } else if (focusedComponent === "detail") {
    }
  });

  return (
    <Box flexDirection="column" width="100%">
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
          }}
        />
      </Box>

      <Box height={20}>
        <VaultList
          filteredCiphers={filteredCiphers}
          listIndex={listIndex}
          isFocused={focusedComponent === "list"}
        />

        <CipherDetail
          selectedCipher={selectedCipher}
          isFocused={focusedComponent === "detail"}
          onChange={(cipher) => {
            if (detailMode === "new") {
              setEditedCipher(cipher);
              return;
            }
            setCiphers((prev) =>
              prev.map((c) => (c.id === cipher.id ? cipher : c))
            );
          }}
        />
      </Box>

      <HelpBar />
    </Box>
  );
}
