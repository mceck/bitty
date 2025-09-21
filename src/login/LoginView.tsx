import { Box, Text, useFocusManager, useStdout } from "ink";
import { useEffect, useState } from "react";
import { TextInput } from "../components/TextInput.js";
import { Button } from "../components/Button.js";
import { primary } from "../theme/style.js";
import { bwClient, loadConfig, saveConfig } from "../hooks/bw.js";
import { useStatusMessage } from "../hooks/status-message.js";

type Props = {
  onLogin: () => void;
};

const art = `
 ███████████   ███  ███████████ ███████████ █████ █████
░░███░░░░░███ ░░░  ░█░░░███░░░█░█░░░███░░░█░░███ ░░███
 ░███    ░███ ████ ░   ░███  ░ ░   ░███  ░  ░░███ ███
 ░██████████ ░░███     ░███        ░███      ░░█████
 ░███░░░░░███ ░███     ░███        ░███       ░░███
 ░███    ░███ ░███     ░███        ░███        ░███
 ███████████  █████    █████       █████       █████
░░░░░░░░░░░  ░░░░░    ░░░░░       ░░░░░       ░░░░░
`;

export function LoginView({ onLogin }: Props) {
  const [url, setUrl] = useState("https://vault.bitwarden.eu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { stdout } = useStdout();
  const { focusNext } = useFocusManager();
  const { statusMessage, statusMessageColor, showStatusMessage } =
    useStatusMessage();

  const handleLogin = async () => {
    try {
      if (!email?.length || !password?.length) {
        focusNext();
        showStatusMessage("Please provide both email and password.", "error");
        return;
      }
      if (url?.trim().length) {
        bwClient.setUrls({ baseUrl: url });
      }
      await bwClient.login(email, password);

      if (!bwClient.refreshToken || !bwClient.keys)
        throw new Error("Missing URL or keys after login");

      onLogin();
      saveConfig({
        baseUrl: url?.trim().length ? url.trim() : undefined,
        keys: bwClient.keys,
        refreshToken: bwClient.refreshToken,
      });
    } catch (e) {
      showStatusMessage(
        "Login failed, please check your credentials.",
        "error"
      );
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const loggedIn = await loadConfig();
        if (loggedIn) {
          onLogin();
        }
      } catch (e) {
        showStatusMessage("Failed to load config file", "error");
      }
    })();
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
        <TextInput placeholder="Server URL" value={url} onChange={setUrl} />
        <TextInput
          autoFocus
          placeholder="Email address"
          value={email}
          onChange={setEmail}
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
        {statusMessage && (
          <Box marginTop={1} width="100%" justifyContent="center">
            <Text color={statusMessageColor}>{statusMessage}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
