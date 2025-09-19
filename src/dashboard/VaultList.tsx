import { Box, Text } from "ink";
import { Cipher, CipherType } from "./models.js";
import { primary, primaryDark, primaryLight } from "../theme/style.js";

const getTypeIcon = (type: CipherType) => {
  switch (type) {
    case CipherType.Login:
      return "👤";
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
  listIndex,
}: {
  filteredCiphers: Cipher[];
  isFocused: boolean;
  listIndex: number;
}) {
  return (
    <Box
      flexDirection="column"
      width="40%"
      borderStyle="round"
      borderColor={isFocused ? primaryLight : "gray"}
      borderRightColor="gray"
      paddingX={1}
    >
      {filteredCiphers.map((cipher, index) => (
        <Box
          key={cipher.id}
          justifyContent="space-between"
          backgroundColor={
            listIndex === index ? (isFocused ? primary : primaryDark) : ""
          }
        >
          <Box>
            <Text>{getTypeIcon(cipher.type)} </Text>
            <Text
              color={listIndex === index && isFocused ? "white" : "default"}
            >
              {cipher.name}
            </Text>
          </Box>
          {cipher.favorite && <Text color="yellow">★</Text>}
        </Box>
      ))}
    </Box>
  );
}
