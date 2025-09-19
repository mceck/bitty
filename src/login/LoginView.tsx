import { Box, Text, useFocusManager, useStdout } from "ink";
import { useEffect, useState } from "react";
import { TextInput } from "../components/TextInput.js";
import { Button } from "../components/Button.js";
import { primary } from "../theme/style.js";
import { bwClient, loadConfig, saveConfig } from "../hooks/bw.js";

type Props = {
  onLogin: () => void;
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

export function LoginView({ onLogin }: Props) {
  const [url, setUrl] = useState("https://vault.bitwarden.eu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { stdout } = useStdout();
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
    saveConfig({
      baseUrl: url?.trim().length ? url : undefined,
      username: email,
      password: password,
    });
  };

  useEffect(() => {
    loadConfig().then((loggedIn) => {
      if (loggedIn) {
        onLogin();
      }
    });
  }, []);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      padding={1}
      flexGrow={1}
      minHeight={stdout.rows - 2}
    >
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
