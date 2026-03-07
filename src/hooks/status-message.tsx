import { createContext, useContext, useRef, useState } from "react";

type StatusMessageType = "info" | "error" | "warning" | "success";

const statusMessageContext = createContext<{
  statusMessage: string | null;
  statusMessageColor: string;
  showStatusMessage: (
    message: string,
    type?: StatusMessageType,
    timeoutMs?: number
  ) => void;
}>({
  statusMessage: null,
  statusMessageColor: "#9f9f9f",
  showStatusMessage: () => {},
});

const SMProvider = statusMessageContext.Provider;

export const StatusMessageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<StatusMessageType>("info");
  const timeout = useRef<NodeJS.Timeout | null>(null);

  const showStatusMessage = (
    message: string,
    type: StatusMessageType = "info",
    timeoutMs: number = 3000
  ) => {
    setStatusMessage(message);
    setMessageType(type);
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      setStatusMessage(null);
    }, timeoutMs);
  };
  const statusMessageColor =
    messageType === "error"
      ? "red"
      : messageType === "success"
      ? "green"
      : messageType === "warning"
      ? "yellow"
      : "#9f9f9f";

  return (
    <SMProvider
      value={{ statusMessage, statusMessageColor, showStatusMessage }}
    >
      {children}
    </SMProvider>
  );
};

export const useStatusMessage = () => useContext(statusMessageContext);
