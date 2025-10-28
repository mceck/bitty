import { Box, Text, useFocusManager, useStdout } from "ink";
import { useEffect, useState } from "react";
import { TextInput } from "../components/TextInput.js";
import { Button } from "../components/Button.js";
import { primary } from "../theme/style.js";
import { bwClient, loadConfig, saveConfig } from "../hooks/bw.js";
import { useStatusMessage } from "../hooks/status-message.js";
import { Checkbox } from "../components/Checkbox.js";
import { FetchError, TwoFactorProvider } from "../clients/bw.js";

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
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("https://vault.bitwarden.eu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaParams, setMfaParams] = useState<any>(null);
  const [askMfa, setAskMfa] = useState<any>(null);
  const [rememberMe, setRememberMe] = useState(false);
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
      try {
        if (mfaParams) {
          mfaParams.twoFactorRemember = rememberMe ? 1 : 0;
        }
        await bwClient.login(email, password, !!mfaParams, mfaParams);
      } catch (e) {
        if (e instanceof FetchError) {
          const data = e.json();
          if (data.TwoFactorProviders) {
            if (data.TwoFactorProviders.length === 1) {
              setMfaParams({
                twoFactorProvider: data.TwoFactorProviders[0],
              });
            } else if (data.TwoFactorProviders.length > 1) {
              setAskMfa(data.TwoFactorProviders);
            }
          }
        } else {
          throw e;
        }
      }

      if (!bwClient.refreshToken || !bwClient.keys)
        throw new Error("Missing URL or keys after login");

      onLogin();
      if (rememberMe) {
        saveConfig({
          baseUrl: url?.trim().length ? url.trim() : undefined,
          keys: bwClient.keys,
          refreshToken: bwClient.refreshToken,
        });
      }
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
      } finally {
        setLoading(false);
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
      {loading ? (
        <Text>Loading...</Text>
      ) : askMfa ? (
        <Box flexDirection="column" width="50%">
          {Object.values(askMfa).map((provider: any) => (
            <Button
              key={provider}
              autoFocus
              onClick={() => {
                if (provider === "1") {
                  bwClient.sendEmailMfaCode(email);
                }
                setMfaParams((p: any) => ({
                  ...p,
                  twoFactorProvider: provider,
                }));
                setAskMfa(null);
              }}
            >
              {TwoFactorProvider[provider]}
            </Button>
          ))}
        </Box>
      ) : mfaParams && mfaParams.twoFactorProvider ? (
        <Box flexDirection="column" width="50%">
          <TextInput
            autoFocus
            placeholder={`Enter your ${
              TwoFactorProvider[mfaParams.twoFactorProvider]
            } code`}
            value={mfaParams.twoFactorToken || ""}
            onChange={(value) =>
              setMfaParams((p: any) => ({ ...p, twoFactorToken: value }))
            }
            onSubmit={() => handleLogin()}
          />
        </Box>
      ) : (
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
          <Box>
            <Checkbox
              label="Remember me (less secure)"
              value={rememberMe}
              width="50%"
              onToggle={setRememberMe}
            />
            <Button width="50%" onClick={() => handleLogin()}>
              Log In
            </Button>
          </Box>
          {statusMessage && (
            <Box marginTop={1} width="100%" justifyContent="center">
              <Text color={statusMessageColor}>{statusMessage}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
