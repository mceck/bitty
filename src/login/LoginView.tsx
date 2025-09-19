import { Box, Text, useFocusManager } from "ink";
import { useState } from "react";
import { TextInput } from "../components/TextInput.js";
import { Button } from "../components/Button.js";
import { primary } from "../theme/style.js";
import { bwClient } from "../hooks/bw.js";

type Props = {
  onLogin: () => void;
};

export function LoginView({ onLogin }: Props) {
  const [url, setUrl] = useState("https://vault.bitwarden.eu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { focusNext } = useFocusManager();

  const handleLogin = async () => {
    if (!email?.length || !password?.length) {
      focusNext();
      return;
    }
    if (url?.trim().length) {
      bwClient.setUrls({ baseUrl: url });
    }
    await bwClient.login(email, password);
    onLogin();
  };

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
          placeholder="Server URL"
          value={url}
          onChange={setUrl}
          onSubmit={focusNext}
        />
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
          onSubmit={() => {
            if (email?.length && password?.length) {
              handleLogin();
            } else {
              focusNext();
            }
          }}
          isPassword
        />
        <Button onClick={handleLogin}>Log In</Button>
      </Box>
    </Box>
  );
}
