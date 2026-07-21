import { Box, Text } from "ink";
import { Cipher, CipherType } from "../../clients/bw.js";
import { primaryLight } from "../../theme/style.js";
import { TextInput } from "../../components/TextInput.js";
import { TabButton } from "../../components/TabButton.js";
import { useEffect, useState } from "react";
import { computeTotp, parseTotpConfig, TotpConfig, totpPeriod } from "../../utils/totp.js";

function Field({
  label,
  value,
  isFocused,
  onChange,
  isPassword,
  labelWidth = 12,
  maxLines = 3,
}: {
  label: string;
  value: string;
  isFocused: boolean;
  onChange?: (v: string) => void;
  isPassword?: boolean;
  labelWidth?: number;
  maxLines?: number;
}) {
  return (
    <Box flexDirection="row">
      <Box width={labelWidth} flexShrink={0}>
        <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
          {label}:
        </Text>
      </Box>
      <Box flexGrow={1}>
        <TextInput
          inline
          isActive={isFocused}
          isPassword={isPassword}
          showPasswordOnFocus={isPassword}
          value={value}
          multiline={maxLines > 1}
          maxLines={maxLines}
          onChange={onChange}
        />
      </Box>
    </Box>
  );
}

export function MainTab({
  isFocused,
  selectedCipher,
  mode,
  onChange,
  onTypeChange,
}: {
  isFocused: boolean;
  selectedCipher: Cipher;
  mode: "view" | "new";
  onChange: (cipher: Cipher) => void;
  onTypeChange?: (type: CipherType) => void;
}) {
  const [otpCode, setOtpCode] = useState("");
  const [otpTimeout, setOtpTimeout] = useState(0);

  const genOtp = async (config: TotpConfig) => {
    if (!config.secret) return;
    const totp = await computeTotp(config);
    if (totp) {
      if (selectedCipher.login) {
        selectedCipher.login.currentTotp = totp;
      }
      setOtpCode(totp);
    } else {
      setOtpCode("");
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (selectedCipher?.login?.totp) {
      const config = parseTotpConfig(selectedCipher.login.totp);
      const intervalSeconds = totpPeriod(config);

      const remainingFor = (nowMs: number) =>
        intervalSeconds - (Math.floor(nowMs / 1000) % intervalSeconds);

      void genOtp(config);
      let lastRemaining = remainingFor(Date.now());
      setOtpTimeout(lastRemaining);
      interval = setInterval(() => {
        const remaining = remainingFor(Date.now());
        if (remaining > lastRemaining) {
          void genOtp(config);
        }
        lastRemaining = remaining;
        setOtpTimeout(remaining);
      }, 1000);
    } else {
      setOtpCode("");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedCipher?.login?.totp]);

  const updateIdentity = (patch: Partial<NonNullable<Cipher["identity"]>>) =>
    onChange({ ...selectedCipher, identity: { ...selectedCipher.identity!, ...patch } });

  const updateCard = (patch: Partial<NonNullable<Cipher["card"]>>) =>
    onChange({ ...selectedCipher, card: { ...selectedCipher.card!, ...patch } });

  return (
    <Box flexDirection="column" gap={1}>
      {mode === "new" && (
        <Box flexDirection="row" gap={1}>
          <Box width={10} flexShrink={0}>
            <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
              Type:
            </Text>
          </Box>
          {([
            [CipherType.Login, "Login"],
            [CipherType.SecureNote, "Note"],
            [CipherType.Card, "Card"],
            [CipherType.Identity, "Identity"],
          ] as const).map(([t, label]) => (
            <TabButton
              key={t}
              borderLess
              active={selectedCipher.type === t}
              onClick={() => onTypeChange?.(t)}
            >
              {label}
            </TabButton>
          ))}
        </Box>
      )}

      <Field
        label="Name"
        labelWidth={selectedCipher.type === CipherType.SSHKey ? 13 : 12}
        value={selectedCipher.name}
        isFocused={isFocused}
        onChange={(value) => onChange({ ...selectedCipher, name: value })}
      />

      {selectedCipher.type === CipherType.Login && (
        <Field
          label="Username"
          value={selectedCipher.login?.username ?? ""}
          isFocused={isFocused}
          onChange={(value) =>
            onChange({
              ...selectedCipher,
              login: { ...selectedCipher.login, username: value },
            })
          }
        />
      )}

      {selectedCipher.type === CipherType.Login && (
        <Box flexDirection="row">
          <Box flexDirection="row" flexGrow={1}>
            <Box width={12} flexShrink={0}>
              <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                Password:
              </Text>
            </Box>
            <Box flexGrow={1}>
              <TextInput
                inline
                isPassword
                showPasswordOnFocus
                isActive={isFocused}
                value={selectedCipher.login?.password ?? ""}
                onChange={(value) =>
                  onChange({
                    ...selectedCipher,
                    login: { ...selectedCipher.login, password: value },
                  })
                }
              />
            </Box>
          </Box>
          {selectedCipher.login?.totp && (
            <Box flexDirection="row" width={20} flexShrink={0}>
              <Box flexShrink={0} width={12}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  OTP ({otpTimeout.toString().padStart(2, "0")}s):
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput inline isActive={isFocused} value={otpCode} />
              </Box>
            </Box>
          )}
        </Box>
      )}

      {selectedCipher.type === CipherType.Login && (
        <Field
          label="URL"
          value={selectedCipher.login?.uris?.[0]?.uri ?? ""}
          isFocused={isFocused}
          onChange={(value) =>
            onChange({
              ...selectedCipher,
              login: {
                ...selectedCipher.login,
                uris: [
                  { uri: value },
                  ...selectedCipher.login!.uris!.slice(1),
                ],
              },
            })
          }
        />
      )}

      {/* Card fields */}
      {selectedCipher.type === CipherType.Card && (
        <>
          <Field
            label="Cardholder"
            value={selectedCipher.card?.cardholderName ?? ""}
            isFocused={isFocused}
            onChange={(v) => updateCard({ cardholderName: v })}
          />
          <Field
            label="Number"
            value={selectedCipher.card?.number ?? ""}
            isFocused={isFocused}
            isPassword
            onChange={(v) => updateCard({ number: v })}
          />
          <Field
            label="Brand"
            value={selectedCipher.card?.brand ?? ""}
            isFocused={isFocused}
            onChange={(v) => updateCard({ brand: v })}
          />
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="row" flexGrow={1}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Exp Month:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.card?.expMonth ?? ""}
                  onChange={(v) => updateCard({ expMonth: v })}
                />
              </Box>
            </Box>
            <Box flexDirection="row" flexGrow={1}>
              <Box width={10} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Exp Year:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.card?.expYear ?? ""}
                  onChange={(v) => updateCard({ expYear: v })}
                />
              </Box>
            </Box>
          </Box>
          <Field
            label="CVV"
            value={selectedCipher.card?.code ?? ""}
            isFocused={isFocused}
            isPassword
            onChange={(v) => updateCard({ code: v })}
          />
        </>
      )}

      {/* Identity fields */}
      {selectedCipher.type === CipherType.Identity && (
        <>
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Title:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.title ?? ""}
                  onChange={(v) => updateIdentity({ title: v })}
                />
              </Box>
            </Box>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  First Name:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.firstName ?? ""}
                  onChange={(v) => updateIdentity({ firstName: v })}
                />
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Middle:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.middleName ?? ""}
                  onChange={(v) => updateIdentity({ middleName: v })}
                />
              </Box>
            </Box>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Last Name:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.lastName ?? ""}
                  onChange={(v) => updateIdentity({ lastName: v })}
                />
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Username:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.username ?? ""}
                  onChange={(v) => updateIdentity({ username: v })}
                />
              </Box>
            </Box>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Company:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.company ?? ""}
                  onChange={(v) => updateIdentity({ company: v })}
                />
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Email:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.email ?? ""}
                  onChange={(v) => updateIdentity({ email: v })}
                />
              </Box>
            </Box>
            <Box flexDirection="row" width="50%" flexShrink={0}>
              <Box width={12} flexShrink={0}>
                <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
                  Phone:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <TextInput
                  inline
                  isActive={isFocused}
                  value={selectedCipher.identity?.phone ?? ""}
                  onChange={(v) => updateIdentity({ phone: v })}
                />
              </Box>
            </Box>
          </Box>
        </>
      )}

      {/* SSH Key fields */}
      {selectedCipher.type === CipherType.SSHKey && (
        <>
          <Field
            label="Private Key"
            labelWidth={13}
            value={selectedCipher.sshKey?.privateKey ?? ""}
            isFocused={isFocused}
          />
          <Field
            label="Public Key"
            labelWidth={13}
            value={selectedCipher.sshKey?.publicKey ?? ""}
            isFocused={isFocused}
          />
        </>
      )}

      <Box flexDirection="row">
        <Box width={selectedCipher.type === CipherType.SSHKey ? 12 : 11} flexShrink={0}>
          <Text bold color={isFocused ? primaryLight : "#9f9f9f"}>
            Notes:
          </Text>
        </Box>
        <Box flexGrow={1} minHeight={6}>
          <TextInput
            multiline
            maxLines={5}
            isActive={isFocused}
            value={selectedCipher.notes ?? ""}
            onChange={(value) =>
              onChange({
                ...selectedCipher,
                notes: value,
              })
            }
          />
        </Box>
      </Box>
    </Box>
  );
}
