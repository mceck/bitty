import { Box, Text, useStdout } from "ink";
import { primary, primaryDark, primaryLight } from "../../theme/style.js";
import { Cipher, CipherType } from "mcbw";
import { ScrollView } from "../../components/ScrollView.js";

const getTypeIcon = (type: CipherType) => {
  switch (type) {
    case CipherType.Login:
      return "🔑";
    case CipherType.SecureNote:
      return "📝";
    case CipherType.Card:
      return "💳";
    case CipherType.Identity:
      return "🆔";
    default:
      return "❓";
  }
};

export function VaultList({
  filteredCiphers,
  isFocused,
  selected,
  onSelect,
}: {
  filteredCiphers: Cipher[];
  isFocused: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const { stdout } = useStdout();
  return (
    <Box
      flexDirection="column"
      width="40%"
      borderStyle="round"
      borderColor={isFocused ? primaryLight : "gray"}
      borderRightColor="gray"
      paddingX={1}
      overflow="hidden"
    >
      <ScrollView
        isActive={isFocused}
        count={stdout.rows - 14}
        list={filteredCiphers}
        selectedIndex={selected ?? 0}
        onSelect={onSelect}
      >
        {({ el: cipher, selected }) => (
          <Box
            key={cipher.id}
            justifyContent="space-between"
            backgroundColor={
              selected ? (isFocused ? primary : primaryDark) : ""
            }
          >
            <Box>
              <Text>{getTypeIcon(cipher.type)} </Text>
              <Text
                color={selected && isFocused ? "white" : "default"}
                wrap="truncate"
              >
                {cipher.name}
              </Text>
            </Box>
            {cipher.favorite && <Text color="yellow">★</Text>}
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
