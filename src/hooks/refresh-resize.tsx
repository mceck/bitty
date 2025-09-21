import { Box, useStdout } from "ink";
import { useCallback, useEffect, useState } from "react";

export const useRefreshResize = () => {
  const [key, setKey] = useState(0);
  const { stdout } = useStdout();
  const rerender = useCallback(() => setKey((prev) => (prev + 1) % 2), []);

  useEffect(() => {
    stdout.on("resize", rerender);
    return () => {
      stdout.off("resize", rerender);
    };
  }, [rerender]);
  return <Box key={key} />;
};
