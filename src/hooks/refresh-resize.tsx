import { Box, useStdout } from "ink";
import { useEffect, useState } from "react";

export const useRefreshResize = () => {
  const [key, setKey] = useState(0);
  const rerender = () => setKey((prev) => (prev + 1) % 10000);
  const { stdout } = useStdout();

  useEffect(() => {
    stdout.on("resize", rerender);
    return () => {
      stdout.off("resize", rerender);
    };
  }, []);
  return <Box key={key} />;
};
