import { Box, Text, useFocusManager, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";
import { TextInput } from "../components/TextInput.js";
import { Button } from "../components/Button.js";
import { primary } from "../theme/style.js";
import { bwClient, loadConfig, saveConfig } from "../hooks/bw.js";
import { useStatusMessage } from "../hooks/status-message.js";
import { Checkbox } from "../components/Checkbox.js";
import { FetchError, TwoFactorProvider } from "../clients/bw.js";
import { art } from "../theme/art.js";

type Props = {
  onLogin: () => void;
};

export function LoginView({ onLogin }: Props) {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("https://vault.bitwarden.eu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaParams, setMfaParams] = useState<any>(null);
  const [askMfa, setAskMfa] = useState<any>(null);
  const [mfaProviderData, setMfaProviderData] = useState<Record<
    string,
    any
  > | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [resendTimeout, setResendTimeout] = useState(0);
  const { stdout } = useStdout();
  const { focusNext, focusPrevious } = useFocusManager();
  const { statusMessage, statusMessageColor, showStatusMessage } =
    useStatusMessage();

  const getProviderLabel = (provider: any) =>
    TwoFactorProvider[String(provider)] ?? `Provider ${provider}`;

  const getProviderData = (provider: any) =>
    mfaProviderData?.[String(provider)] ?? null;

  const isEmailProvider = (provider: any) => String(provider) === "1";
  const isDuoProvider = (provider: any) =>
    String(provider) === "2" || String(provider) === "6";
  const isWebAuthnProvider = (provider: any) => String(provider) === "7";

  useInput(
    async (_, key) => {
      if (key.upArrow) {
        focusPrevious();
      } else if (key.downArrow) {
        focusNext();
      }
    },
    { isActive: !loading }
  );

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
          if (data.TwoFactorProviders2) {
            setMfaProviderData(data.TwoFactorProviders2);
          }
          if (data.TwoFactorProviders) {
            const providers = data.TwoFactorProviders;
            if (providers.length === 1) {
              setMfaParams({
                twoFactorProvider: providers[0],
              });
            } else if (providers.length > 1) {
              setAskMfa(providers);
            }
          } else if (data.TwoFactorProviders2) {
            const providers = Object.keys(data.TwoFactorProviders2);
            if (providers.length === 1) {
              setMfaParams({
                twoFactorProvider: providers[0],
              });
            } else if (providers.length > 1) {
              setAskMfa(providers);
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimeout > 0) {
      interval = setInterval(() => {
        setResendTimeout((t) => t - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimeout]);

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
                if (
                  isEmailProvider(provider) &&
                  (Object.values(askMfa).length > 1 ||
                    !bwClient.isVaultWarden())
                ) {
                  bwClient.sendEmailMfaCode(email);
                }
                setMfaParams((p: any) => ({
                  ...p,
                  twoFactorProvider: provider,
                }));
                setAskMfa(null);
              }}
            >
              {getProviderLabel(provider)}
            </Button>
          ))}
        </Box>
      ) : mfaParams && mfaParams.twoFactorProvider ? (
        <Box flexDirection="column" width="50%">
          {isDuoProvider(mfaParams.twoFactorProvider) && (
            <Box flexDirection="column" marginBottom={1}>
              <Text>
                Open the Duo URL in a browser and approve the request.
              </Text>
              <Text>
                Then paste the `code` and `state` from the final URL as
                `code|state`.
              </Text>
              {getProviderData(mfaParams.twoFactorProvider)?.AuthUrl && (
                <Text>
                  Auth URL:{" "}
                  {getProviderData(mfaParams.twoFactorProvider).AuthUrl}
                </Text>
              )}
            </Box>
          )}
          {isWebAuthnProvider(mfaParams.twoFactorProvider) && (
            <Box flexDirection="column" marginBottom={1}>
              <Text>
                Use your FIDO2/WebAuthn security key to generate a response,
                then paste it here.
              </Text>
            </Box>
          )}
          <TextInput
            autoFocus
            placeholder={`Enter your ${getProviderLabel(
              mfaParams.twoFactorProvider
            )} ${
              isWebAuthnProvider(mfaParams.twoFactorProvider)
                ? "response"
                : "code"
            }`}
            value={mfaParams.twoFactorToken || ""}
            onChange={(value) =>
              setMfaParams((p: any) => ({ ...p, twoFactorToken: value }))
            }
            onSubmit={() => handleLogin()}
          />
          {isEmailProvider(mfaParams.twoFactorProvider) && (
            <Button
              marginTop={1}
              isActive={resendTimeout === 0}
              onClick={() => {
                bwClient
                  .sendEmailMfaCode(email)
                  .then(() => {
                    showStatusMessage(
                      "Sent new MFA code to your email.",
                      "success"
                    );
                  })
                  .catch(() => {
                    showStatusMessage("Failed to resend MFA code.", "error");
                  });
                setResendTimeout(30);
              }}
            >
              Resend Code
            </Button>
          )}
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
