import { Box, Text, useFocusManager } from "ink";
import { useState } from "react";
import { TextInput } from "../components/TextInput.js";
import { Button } from "../components/Button.js";
import { primary } from "../theme/style.js";

type Props = {
  onLogin: () => void;
};

export function LoginView({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { focusNext } = useFocusManager();

  const art = `
 ███████████  █████   ███   █████            ███████████ █████  █████ █████
░░███░░░░░███░░███   ░███  ░░███            ░█░░░███░░░█░░███  ░░███ ░░███
 ░███    ░███ ░███   ░███   ░███            ░   ░███  ░  ░███   ░███  ░███
 ░██████████  ░███   ░███   ░███  ██████████    ░███     ░███   ░███  ░███
 ░███░░░░░███ ░░███  █████  ███  ░░░░░░░░░░     ░███     ░███   ░███  ░███
 ░███    ░███  ░░░█████░█████░                  ░███     ░███   ░███  ░███
 ███████████     ░░███ ░░███                    █████    ░░████████   █████
░░░░░░░░░░░       ░░░   ░░░                    ░░░░░      ░░░░░░░░   ░░░░░
`;
  return (
    <Box flexDirection="column" alignItems="center" padding={2}>
      <Box marginBottom={2}>
        <Text color={primary}>{art}</Text>
      </Box>
      <Box flexDirection="column" width="50%">
        <TextInput
          autoFocus
          placeholder="Email address"
          value={email}
          onChange={setEmail}
          onSubmit={focusNext}
        />
        <TextInput
          placeholder="Master password"
          value={password}
          onChange={setPassword}
          onSubmit={focusNext}
          isPassword
        />
        <Button onClick={onLogin}>Log In</Button>
      </Box>
    </Box>
  );
}
